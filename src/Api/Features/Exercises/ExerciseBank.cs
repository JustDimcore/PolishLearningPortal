using System.Text;
using PolishApp.Api.Features.Content;
using PolishApp.Api.Features.Lessons;
using YamlDotNet.Core;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace PolishApp.Api.Features.Exercises;

/// <summary>
/// The exercise bank (content/exercises/&lt;lesson&gt;.yaml), loaded and validated once at startup.
/// Answers stay on the server: the client gets <see cref="Exercise"/> views and sends answers to <see cref="Check"/>.
/// </summary>
internal sealed class ExerciseBank
{
    public const int SessionSize = 10;
    public const string Gap = "___";
    private const string Directory = "exercises";

    private static readonly IDeserializer Yaml = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .Build();

    private readonly Dictionary<string, Definition> _byId;
    private readonly IReadOnlyList<ExerciseSet> _sets;

    private ExerciseBank(Dictionary<string, Definition> byId, IReadOnlyList<ExerciseSet> sets)
    {
        _byId = byId;
        _sets = sets;
    }

    public ExerciseSetsResponse Sets => new(_sets);

    public bool HasLesson(string lesson) => _sets.Any(s => s.Lesson == lesson);

    /// <summary>Up to <see cref="SessionSize"/> exercises of a lesson in random order.</summary>
    public SessionResponse LessonSession(string lesson) =>
        new(lesson, [.. Shuffle(_byId.Values.Where(d => d.View.Lesson == lesson)).Take(SessionSize).Select(d => d.View)]);

    /// <summary>The given exercises in random order (e.g. to repeat mistakes); null when an id is unknown.</summary>
    public SessionResponse? CustomSession(IEnumerable<string> ids)
    {
        var definitions = new List<Definition>();
        foreach (var id in ids.Distinct(StringComparer.Ordinal))
        {
            if (!_byId.TryGetValue(id, out var definition))
            {
                return null;
            }

            definitions.Add(definition);
        }

        return new SessionResponse(null, [.. Shuffle(definitions).Select(d => d.View)]);
    }

    public bool TryGet(string id, out int gaps)
    {
        gaps = _byId.TryGetValue(id, out var definition) ? definition.Accepted.Count : 0;
        return gaps > 0;
    }

    /// <summary>Checks answers deterministically. Case and extra spaces are ignored; diacritics are not.</summary>
    public CheckResponse Check(string id, IReadOnlyList<string> answers)
    {
        var definition = _byId[id];
        if (answers.Count == 0)
        {
            return new CheckResponse(
                Verdict.Skipped,
                [.. definition.Accepted.Select(a => new AnswerCheck("", a[0], Verdict.Skipped))],
                definition.Explanation);
        }

        var checks = definition.Accepted.Select((accepted, i) => CheckOne(answers[i], accepted)).ToList();
        var verdict = checks.All(c => c.Verdict == Verdict.Correct) ? Verdict.Correct
            : checks.Any(c => c.Verdict == Verdict.Wrong) ? Verdict.Wrong
            : Verdict.Almost;
        return new CheckResponse(verdict, checks, definition.Explanation);
    }

    private static AnswerCheck CheckOne(string given, IReadOnlyList<string> accepted)
    {
        var canonical = PolishText.Canonical(given);
        if (accepted.Any(a => PolishText.Canonical(a) == canonical))
        {
            return new AnswerCheck(given, accepted.First(a => PolishText.Canonical(a) == canonical), Verdict.Correct);
        }

        var loose = PolishText.WithoutDiacritics(canonical);
        var near = accepted.FirstOrDefault(a => PolishText.WithoutDiacritics(PolishText.Canonical(a)) == loose);
        return near is null
            ? new AnswerCheck(given, accepted[0], Verdict.Wrong)
            : new AnswerCheck(given, near, Verdict.Almost);
    }

    private static List<T> Shuffle<T>(IEnumerable<T> items)
    {
        var list = items.ToList();
        Random.Shared.Shuffle(System.Runtime.InteropServices.CollectionsMarshal.AsSpan(list));
        return list;
    }

    /// <exception cref="ContentValidationException">A file is invalid or refers to an unknown lesson.</exception>
    public static ExerciseBank Load(string contentRoot, LessonCatalog lessons)
    {
        var errors = new List<ContentError>();
        var byId = new Dictionary<string, Definition>(StringComparer.Ordinal);
        var path = Path.Combine(contentRoot, Directory);

        if (System.IO.Directory.Exists(path))
        {
            foreach (var filePath in System.IO.Directory.EnumerateFiles(path, "*.yaml").Order(StringComparer.Ordinal))
            {
                var file = $"{Directory}/{Path.GetFileName(filePath)}";
                foreach (var definition in ReadFile(file, File.ReadAllText(filePath, Encoding.UTF8), lessons, errors))
                {
                    if (!byId.TryAdd(definition.View.Id, definition))
                    {
                        errors.Add(new ContentError(file, 0, $"Duplicate exercise id '{definition.View.Id}'"));
                    }
                }
            }
        }

        if (errors.Count > 0)
        {
            throw new ContentValidationException(errors);
        }

        var sets = byId.Values
            .GroupBy(d => d.View.Lesson)
            .Select(g => (Lesson: lessons.Find(g.Key)!, Count: g.Count()))
            .OrderBy(x => x.Lesson.Number)
            .Select(x => new ExerciseSet(x.Lesson.Slug, x.Lesson.Number, x.Lesson.Title, x.Count))
            .ToList();

        return new ExerciseBank(byId, sets);
    }

    /// <summary>Parses one bank file; problems go to <paramref name="errors"/> and the offending exercise is skipped.</summary>
    internal static IEnumerable<Definition> ReadFile(string file, string yaml, LessonCatalog lessons, List<ContentError> errors)
    {
        BankFile? bank;
        try
        {
            bank = Yaml.Deserialize<BankFile>(yaml);
        }
        catch (YamlException ex)
        {
            errors.Add(new ContentError(file, (int)ex.Start.Line, ex.InnerException?.Message ?? ex.Message));
            return [];
        }

        var expectedLesson = Path.GetFileNameWithoutExtension(file);
        if (bank?.Lesson != expectedLesson)
        {
            errors.Add(new ContentError(file, 0, $"'lesson' must match the file name \"{expectedLesson}\""));
            return [];
        }

        if (lessons.Find(bank.Lesson) is null)
        {
            errors.Add(new ContentError(file, 0, $"Lesson '{bank.Lesson}' does not exist"));
            return [];
        }

        var result = new List<Definition>();
        foreach (var entry in bank.Exercises)
        {
            var errorsBefore = errors.Count;
            var definition = ReadExercise(file, bank.Lesson, entry, errors);
            if (definition is not null && errors.Count == errorsBefore)
            {
                result.Add(definition);
            }
        }

        return result;
    }

    private static Definition? ReadExercise(string file, string lesson, ExerciseEntry e, List<ContentError> errors)
    {
        var where = $"exercise '{e.Id ?? "?"}'";
        void Error(string message) => errors.Add(new ContentError(file, 0, $"{where}: {message}"));

        if (string.IsNullOrWhiteSpace(e.Id))
        {
            Error("'id' is required");
            return null;
        }

        if (string.IsNullOrWhiteSpace(e.Instruction))
        {
            Error("'instruction' is required");
        }

        if (string.IsNullOrWhiteSpace(e.Explanation))
        {
            Error("'explanation' is required");
        }

        var explanation = string.IsNullOrWhiteSpace(e.Explanation) ? [] : MarkdownContentParser.ParseInline(file, 0, e.Explanation, errors);
        var instruction = e.Instruction ?? "";

        switch (e.Type)
        {
            case "fill-gap":
            {
                var sentence = ParseGapText(e.Sentence, requireGap: true, Error, file, errors);
                if (string.IsNullOrWhiteSpace(e.Base))
                {
                    Error("'base' is required");
                }

                if (e.Answers is not { Count: > 0 } || e.Answers.Any(string.IsNullOrWhiteSpace))
                {
                    Error("'answers' needs at least one non-empty answer");
                    return null;
                }

                return sentence is null
                    ? null
                    : new Definition(
                        new FillGapExercise(e.Id, lesson, instruction, e.Translation, sentence, e.Base ?? ""),
                        [e.Answers],
                        explanation);
            }

            case "multiple-choice":
            {
                var prompt = ParseGapText(e.Prompt, requireGap: false, Error, file, errors);
                if (e.Options is not { Count: >= 2 } || e.Options.Distinct(StringComparer.Ordinal).Count() != e.Options.Count)
                {
                    Error("'options' needs at least two distinct options");
                    return null;
                }

                if (e.Answer is null || !e.Options.Contains(e.Answer))
                {
                    Error("'answer' must be one of the options");
                    return null;
                }

                return prompt is null
                    ? null
                    : new Definition(
                        new MultipleChoiceExercise(e.Id, lesson, instruction, e.Translation, prompt, e.Options),
                        [[e.Answer]],
                        explanation);
            }

            case "declension-table":
            {
                if (string.IsNullOrWhiteSpace(e.Word))
                {
                    Error("'word' is required");
                }

                if (e.Rows is not { Count: > 0 } || e.Rows.Any(r => string.IsNullOrWhiteSpace(r.Label) || string.IsNullOrWhiteSpace(r.Answer)))
                {
                    Error("'rows' need a label and an answer each");
                    return null;
                }

                var open = e.Rows.Where(r => !r.Given).ToList();
                if (open.Count == 0)
                {
                    Error("at least one row must be left to fill in");
                    return null;
                }

                return new Definition(
                    new DeclensionTableExercise(
                        e.Id,
                        lesson,
                        instruction,
                        e.Translation,
                        e.Word ?? "",
                        [.. e.Rows.Select(r => new DeclensionRow(r.Label!, r.Given ? r.Answer : null))]),
                    [.. open.Select(r => (IReadOnlyList<string>)[r.Answer!])],
                    explanation);
            }

            default:
                Error($"unknown type '{e.Type}'; expected fill-gap, multiple-choice or declension-table");
                return null;
        }
    }

    private static GapText? ParseGapText(string? text, bool requireGap, Action<string> error, string file, List<ContentError> errors)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            error(requireGap ? "'sentence' is required" : "'prompt' is required");
            return null;
        }

        var parts = text.Split(Gap);
        if (parts.Length > 2 || (requireGap && parts.Length != 2))
        {
            error($"the text needs {(requireGap ? "exactly one" : "at most one")} gap ({Gap})");
            return null;
        }

        IReadOnlyList<InlineSpan> Inline(string part) =>
            string.IsNullOrWhiteSpace(part) ? [] : MarkdownContentParser.ParseInline(file, 0, part, errors);

        // Markdown trims the edges of a part; keep the spaces around the gap explicit.
        var before = Inline(parts[0]).ToList();
        if (parts.Length == 2 && parts[0].EndsWith(' ') && before.Count > 0)
        {
            before[^1] = before[^1] with { Text = before[^1].Text + " " };
        }

        var after = parts.Length == 2 ? Inline(parts[1]).ToList() : [];
        if (parts.Length == 2 && parts[1].StartsWith(' ') && after.Count > 0)
        {
            after[0] = after[0] with { Text = " " + after[0].Text };
        }

        return new GapText(before, parts.Length == 2, after);
    }

    /// <summary>An exercise with its accepted answers: one list of accepted forms per gap.</summary>
    internal sealed record Definition(Exercise View, IReadOnlyList<IReadOnlyList<string>> Accepted, IReadOnlyList<InlineSpan> Explanation);

    private sealed class BankFile
    {
        public string? Lesson { get; set; }
        public List<ExerciseEntry> Exercises { get; set; } = [];
    }

    private sealed class ExerciseEntry
    {
        public string? Id { get; set; }
        public string? Type { get; set; }
        public string? Instruction { get; set; }
        public string? Translation { get; set; }
        public string? Explanation { get; set; }
        public string? Sentence { get; set; }
        public string? Base { get; set; }
        public List<string>? Answers { get; set; }
        public string? Prompt { get; set; }
        public List<string>? Options { get; set; }
        public string? Answer { get; set; }
        public string? Word { get; set; }
        public List<RowEntry>? Rows { get; set; }
    }

    private sealed class RowEntry
    {
        public string? Label { get; set; }
        public string? Answer { get; set; }
        public bool Given { get; set; }
    }
}
