using PolishApp.Api.Features.Lessons;

namespace PolishApp.Api.Tests;

public sealed class LessonParserTests
{
    private const string FrontMatter = """
        ---
        slug: sample
        title: Sample
        subtitle: Subtitle
        summary: Answers **kto? co?**
        minutes: 5
        ---

        """;

    private static (LessonDocument? Lesson, List<ContentError> Errors) Parse(string body, string file = "lessons/sample.md")
    {
        var errors = new List<ContentError>();
        var lesson = LessonParser.Parse(file, FrontMatter + body, errors);
        return (lesson, errors);
    }

    /// <summary>Renders spans as "text[marks]" so that list-valued records compare by content.</summary>
    private static string[] Show(IEnumerable<InlineSpan> spans) =>
        [.. spans.Select(s => s.Marks.Count == 0 ? s.Text : $"{s.Text}[{string.Join(',', s.Marks)}]")];

    [Fact]
    public void Parses_front_matter_and_numbers_sections()
    {
        var (lesson, errors) = Parse("""
            ## First

            Text.

            ## Second

            More text.
            """);

        Assert.Empty(errors);
        Assert.NotNull(lesson);
        Assert.Equal("Sample", lesson.Title);
        Assert.Equal(5, lesson.Minutes);
        Assert.Equal(["Answers ", "kto? co?[Bold]"], Show(lesson.Summary));
        Assert.Collection(
            lesson.Sections,
            s => Assert.Equal(("section-1", 1, "First"), (s.Id, s.Number, s.Title)),
            s => Assert.Equal(("section-2", 2, "Second"), (s.Id, s.Number, s.Title)));
    }

    [Fact]
    public void Marks_endings_inside_formatted_text()
    {
        var (lesson, errors) = Parse("""
            ## S

            Nie mam *czas{u}*.
            """);

        Assert.Empty(errors);
        var paragraph = Assert.IsType<ParagraphBlock>(Assert.Single(lesson!.Sections[0].Blocks));
        Assert.Equal(["Nie mam ", "czas[Italic]", "u[Italic,Ending]", "."], Show(paragraph.Content));
    }

    [Fact]
    public void Turns_arrow_paragraphs_into_notes()
    {
        var (lesson, _) = Parse("""
            ## S

            ↳ A side note.
            """);

        var note = Assert.IsType<NoteBlock>(Assert.Single(lesson!.Sections[0].Blocks));
        Assert.Equal("A side note.", Assert.Single(note.Content).Text);
    }

    [Fact]
    public void Parses_tables()
    {
        var (lesson, errors) = Parse("""
            ## S

            | Gender | Ending |
            |---|---|
            | f. | {-a} |
            """);

        Assert.Empty(errors);
        var table = Assert.IsType<TableBlock>(Assert.Single(lesson!.Sections[0].Blocks));
        Assert.Equal(2, table.Header.Cells.Count);
        Assert.Equal(["-a[Ending]"], Show(Assert.Single(table.Rows).Cells[1].Content));
    }

    [Fact]
    public void Parses_examples_dialogue_and_card_blocks()
    {
        var (lesson, errors) = Parse("""
            ## S

            ```examples
            Negation | Nie mam czas{u}. | No time.
            ```

            ```card title="Lista zakupów" caption="Nominative"
            woda
            ser
            ```

            ```dialogue caption="Genitive"
            Nie ma już chleb{a}? | No bread left?
            ↑ a remark
            Niestety.
            ```
            """);

        Assert.Empty(errors);
        var blocks = lesson!.Sections[0].Blocks;

        var example = Assert.Single(Assert.IsType<ExamplesBlock>(blocks[0]).Items);
        Assert.Equal("Negation", example.Label);
        Assert.Equal("No time.", Assert.Single(example.Translation).Text);

        var card = Assert.IsType<CardBlock>(blocks[1]);
        Assert.Equal(("Lista zakupów", "Nominative", 2), (card.Title, card.Caption, card.Items.Count));

        var dialogue = Assert.IsType<DialogueBlock>(blocks[2]);
        Assert.Equal("Genitive", dialogue.Caption);
        Assert.Equal(2, dialogue.Lines.Count);
        Assert.Equal("a remark", dialogue.Lines[0].Remark);
        Assert.Null(dialogue.Lines[1].Translation);
    }

    [Theory]
    [InlineData("Intro.\n\n## S\n\nText.", "Content before the first section")]
    [InlineData("## S\n\n### Sub\n\nText.", "Only level-2 headings")]
    [InlineData("## S\n\n> quote", "Unsupported Markdown element: quote")]
    [InlineData("## S\n\n```poem\nline\n```", "Unknown block 'poem'")]
    [InlineData("## S\n\n```examples\nonly | two\n```", "three columns")]
    [InlineData("## S\n\n```dialogue\n↑ orphan remark\n```", "A remark (↑) must follow")]
    [InlineData("## S\n\n```card\nwoda\n```", "Card needs a title")]
    [InlineData("## S\n\n```examples size=\"big\"\na | b | c\n```", "Unknown attribute 'size'")]
    [InlineData("## S\n\nczas{u", "Unbalanced")]
    [InlineData("## S\n\n[link](https://example.com)", "Unsupported inline element: Link")]
    [InlineData("## S", "is empty")]
    public void Reports_unsupported_or_malformed_content(string body, string expectedError)
    {
        var (lesson, errors) = Parse(body);

        Assert.Null(lesson);
        Assert.Contains(errors, e => e.Message.Contains(expectedError, StringComparison.Ordinal));
    }

    [Fact]
    public void Reports_line_numbers()
    {
        var (_, errors) = Parse("## S\n\nText.\n\n> quote");

        // 7 front matter lines, then "## S", blank, "Text.", blank, quote.
        Assert.Equal(12, Assert.Single(errors).Line);
    }

    [Fact]
    public void Requires_slug_to_match_file_name()
    {
        var (_, errors) = Parse("## S\n\nText.", file: "lessons/other.md");

        Assert.Contains(errors, e => e.Message.Contains("must match the file name", StringComparison.Ordinal));
    }

    [Fact]
    public void Rejects_unknown_front_matter_keys()
    {
        var errors = new List<ContentError>();

        LessonParser.Parse("lessons/x.md", "---\nslug: x\nlevel: A1\n---\n\n## S\n\nText.", errors);

        Assert.Contains(errors, e => e.Message.StartsWith("Invalid front matter", StringComparison.Ordinal));
    }
}
