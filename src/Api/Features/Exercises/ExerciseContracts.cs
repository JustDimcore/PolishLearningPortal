using System.Text.Json.Serialization;
using PolishApp.Api.Features.Content;

namespace PolishApp.Api.Features.Exercises;

/// <summary>
/// Text with an optional gap: <see cref="Before"/>, the gap (when <see cref="HasGap"/>), then <see cref="After"/>.
/// </summary>
public sealed record GapText(IReadOnlyList<InlineSpan> Before, bool HasGap, IReadOnlyList<InlineSpan> After);

/// <summary>An exercise as the client sees it: without answers. Discriminated by <c>type</c>.</summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(FillGapExercise), "fill-gap")]
[JsonDerivedType(typeof(MultipleChoiceExercise), "multiple-choice")]
[JsonDerivedType(typeof(DeclensionTableExercise), "declension-table")]
public abstract record Exercise(string Id, string Lesson, string Instruction, string? Translation);

/// <summary>Type the form of <see cref="Base"/> that fits the gap.</summary>
public sealed record FillGapExercise(string Id, string Lesson, string Instruction, string? Translation, GapText Sentence, string Base)
    : Exercise(Id, Lesson, Instruction, Translation);

/// <summary>Pick one of <see cref="Options"/>; the prompt may contain a gap the option fills.</summary>
public sealed record MultipleChoiceExercise(
    string Id,
    string Lesson,
    string Instruction,
    string? Translation,
    GapText Prompt,
    IReadOnlyList<string> Options) : Exercise(Id, Lesson, Instruction, Translation);

/// <param name="Given">The form shown as a hint; null for rows the learner fills in.</param>
public sealed record DeclensionRow(string Label, string? Given);

/// <summary>Fill in the forms of <see cref="Word"/>; answers are sent in the order of the rows to fill.</summary>
public sealed record DeclensionTableExercise(
    string Id,
    string Lesson,
    string Instruction,
    string? Translation,
    string Word,
    IReadOnlyList<DeclensionRow> Rows) : Exercise(Id, Lesson, Instruction, Translation);

/// <summary>Exercises of one lesson available for practice.</summary>
public sealed record ExerciseSet(string Lesson, int Number, string Title, int Count);

public sealed record ExerciseSetsResponse(IReadOnlyList<ExerciseSet> Sets);

/// <param name="Lesson">The lesson of the session, or null for a session built from chosen exercises.</param>
public sealed record SessionResponse(string? Lesson, IReadOnlyList<Exercise> Exercises);

/// <param name="Answers">One answer per gap: a single item for fill-gap and multiple choice, one per open row for a table. Empty means "I don't know".</param>
public sealed record CheckRequest(IReadOnlyList<string> Answers);

[JsonConverter(typeof(JsonStringEnumConverter<Verdict>))]
public enum Verdict
{
    [JsonStringEnumMemberName("correct")] Correct,

    /// <summary>Right word, wrong diacritics (kobiete for kobietę). Counted as a mistake.</summary>
    [JsonStringEnumMemberName("almost")] Almost,

    [JsonStringEnumMemberName("wrong")] Wrong,

    /// <summary>The learner chose "I don't know".</summary>
    [JsonStringEnumMemberName("skipped")] Skipped,
}

/// <param name="Expected">The accepted form to show as the correction.</param>
public sealed record AnswerCheck(string Given, string Expected, Verdict Verdict);

/// <param name="Verdict">Overall verdict: correct only when every answer is correct.</param>
public sealed record CheckResponse(Verdict Verdict, IReadOnlyList<AnswerCheck> Answers, IReadOnlyList<InlineSpan> Explanation);
