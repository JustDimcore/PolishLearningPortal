using PolishApp.Api.Features.Content;
using PolishApp.Api.Features.Exercises;
using PolishApp.Api.Features.Lessons;

namespace PolishApp.Api.Tests;

public sealed class ExerciseBankTests : IDisposable
{
    private readonly DirectoryInfo _root = Directory.CreateTempSubdirectory("polish-exercises-");

    public void Dispose() => _root.Delete(recursive: true);

    private void Write(string relativePath, string text)
    {
        var path = Path.Combine(_root.FullName, relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, text);
    }

    private ExerciseBank Load(string bank)
    {
        Write("lessons/a.md", "---\nslug: a\ntitle: A\nsubtitle: s\nsummary: s\nminutes: 5\n---\n\n## S\n\nText.");
        Write("course.yaml", "groups:\n  - { id: g, title: G, lessons: [a] }");
        Write("exercises/a.yaml", bank);
        return ExerciseBank.Load(_root.FullName, LessonCatalog.Load(_root.FullName));
    }

    private const string Bank = """
        lesson: a
        exercises:
          - id: gap
            type: fill-gap
            instruction: Fill
            sentence: Idę do ___ teraz.
            base: sklep
            answers: [sklepu]
            explanation: "After *do*: genitive."
          - id: choice
            type: multiple-choice
            instruction: Pick
            prompt: "*kawa*"
            options: [one, two]
            answer: two
            explanation: Because.
          - id: table
            type: declension-table
            instruction: Fill the table
            word: kobieta
            rows:
              - { label: M sg, answer: kobieta, given: true }
              - { label: D sg, answer: kobiety }
              - { label: M pl, answer: kobiety }
            explanation: Same form.
        """;

    [Fact]
    public void Session_hides_answers_and_splits_the_sentence_at_the_gap()
    {
        var session = Load(Bank).LessonSession("a");

        Assert.Equal(3, session.Exercises.Count);
        var gap = Assert.IsType<FillGapExercise>(session.Exercises.Single(e => e.Id == "gap"));
        Assert.Equal("Idę do ", MarkdownContentParser.ToPlainText(gap.Sentence.Before));
        Assert.Equal(" teraz.", MarkdownContentParser.ToPlainText(gap.Sentence.After));
        Assert.True(gap.Sentence.HasGap);

        var table = Assert.IsType<DeclensionTableExercise>(session.Exercises.Single(e => e.Id == "table"));
        Assert.Equal(["kobieta", null, null], table.Rows.Select(r => r.Given).ToArray());

        var choice = Assert.IsType<MultipleChoiceExercise>(session.Exercises.Single(e => e.Id == "choice"));
        Assert.False(choice.Prompt.HasGap);
    }

    [Theory]
    [InlineData("sklepu", Verdict.Correct)]
    [InlineData("  Sklepu ", Verdict.Correct)]
    [InlineData("sklepa", Verdict.Wrong)]
    public void Checks_a_gap_ignoring_case_and_spaces(string answer, Verdict expected)
    {
        var result = Load(Bank).Check("gap", [answer]);

        Assert.Equal(expected, result.Verdict);
        Assert.Equal("sklepu", Assert.Single(result.Answers).Expected);
        Assert.NotEmpty(result.Explanation);
    }

    [Fact]
    public void Missing_diacritics_are_almost_right_but_not_correct()
    {
        var bank = Load(Bank.Replace("answers: [sklepu]", "answers: [kobietę]", StringComparison.Ordinal));

        Assert.Equal(Verdict.Almost, bank.Check("gap", ["kobiete"]).Verdict);
    }

    [Fact]
    public void Table_is_correct_only_when_every_open_row_is()
    {
        var bank = Load(Bank);

        Assert.Equal(Verdict.Correct, bank.Check("table", ["kobiety", "kobiety"]).Verdict);

        var partial = bank.Check("table", ["kobiety", "kobieta"]);
        Assert.Equal(Verdict.Wrong, partial.Verdict);
        Assert.Equal([Verdict.Correct, Verdict.Wrong], partial.Answers.Select(a => a.Verdict).ToArray());
    }

    [Fact]
    public void No_answers_means_skipped_and_reveals_the_answer()
    {
        var result = Load(Bank).Check("choice", []);

        Assert.Equal(Verdict.Skipped, result.Verdict);
        Assert.Equal("two", Assert.Single(result.Answers).Expected);
    }

    [Fact]
    public void Custom_session_returns_null_for_unknown_ids()
    {
        var bank = Load(Bank);

        Assert.Equal(2, bank.CustomSession(["gap", "table", "gap"])!.Exercises.Count);
        Assert.Null(bank.CustomSession(["gap", "nope"]));
    }

    [Theory]
    [InlineData("sentence: Idę do ___ teraz.", "sentence: No gap here.", "exactly one gap")]
    [InlineData("answer: two", "answer: three", "must be one of the options")]
    [InlineData("type: multiple-choice", "type: essay", "unknown type 'essay'")]
    [InlineData("- { label: M pl, answer: kobiety }", "- { label: M pl, answer: kobiety, given: true }\n      - { label: D sg2, answer: x, given: true }", "")]
    public void Rejects_invalid_exercises(string from, string to, string expectedError)
    {
        var bank = Bank.Replace(from, to, StringComparison.Ordinal);

        if (expectedError.Length == 0)
        {
            Load(bank); // Still valid: one open row remains.
            return;
        }

        var ex = Assert.Throws<ContentValidationException>(() => Load(bank));
        Assert.Contains(expectedError, ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Rejects_a_bank_for_an_unknown_lesson()
    {
        Write("exercises/b.yaml", "lesson: b\nexercises: []");

        var ex = Assert.Throws<ContentValidationException>(() => Load(Bank));

        Assert.Contains("Lesson 'b' does not exist", ex.Message, StringComparison.Ordinal);
    }
}
