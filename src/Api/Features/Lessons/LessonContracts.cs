using System.Text.Json.Serialization;

namespace PolishApp.Api.Features.Lessons;

/// <summary>Formatting applied to a run of text.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<InlineMark>))]
public enum InlineMark
{
    [JsonStringEnumMemberName("bold")] Bold,
    [JsonStringEnumMemberName("italic")] Italic,

    /// <summary>A grammatical ending, highlighted in the UI.</summary>
    [JsonStringEnumMemberName("ending")] Ending,
}

/// <summary>A run of text with uniform formatting. Rich text is a list of spans.</summary>
public sealed record InlineSpan(string Text, IReadOnlyList<InlineMark> Marks);

/// <summary>A content block of a lesson section, discriminated by <c>type</c>.</summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(ParagraphBlock), "paragraph")]
[JsonDerivedType(typeof(NoteBlock), "note")]
[JsonDerivedType(typeof(BulletListBlock), "list")]
[JsonDerivedType(typeof(TableBlock), "table")]
[JsonDerivedType(typeof(ExamplesBlock), "examples")]
[JsonDerivedType(typeof(DialogueBlock), "dialogue")]
[JsonDerivedType(typeof(CardBlock), "card")]
public abstract record LessonBlock;

public sealed record ParagraphBlock(IReadOnlyList<InlineSpan> Content) : LessonBlock;

/// <summary>A muted side note that belongs to its section.</summary>
public sealed record NoteBlock(IReadOnlyList<InlineSpan> Content) : LessonBlock;

public sealed record BulletListBlock(IReadOnlyList<RichLine> Items) : LessonBlock;

public sealed record TableBlock(RichRow Header, IReadOnlyList<RichRow> Rows) : LessonBlock;

/// <summary>Labelled Polish examples with translations.</summary>
public sealed record ExamplesBlock(IReadOnlyList<ExampleItem> Items) : LessonBlock;

/// <param name="Caption">What the dialogue illustrates, shown above it (e.g. which case is used).</param>
public sealed record DialogueBlock(string? Caption, IReadOnlyList<DialogueLine> Lines) : LessonBlock;

/// <summary>A short list on a "paper card" (a shopping list, a menu) shown next to the following block.</summary>
/// <param name="Caption">What the list illustrates, shown above the card (e.g. which case is used).</param>
public sealed record CardBlock(string Title, string? Caption, IReadOnlyList<RichLine> Items) : LessonBlock;

public sealed record RichLine(IReadOnlyList<InlineSpan> Content);

public sealed record RichRow(IReadOnlyList<RichLine> Cells);

public sealed record ExampleItem(string Label, IReadOnlyList<InlineSpan> Text, IReadOnlyList<InlineSpan> Translation);

/// <param name="Remark">A handwritten-style remark about this line, if any.</param>
public sealed record DialogueLine(IReadOnlyList<InlineSpan> Text, IReadOnlyList<InlineSpan>? Translation, string? Remark);

public sealed record LessonSection(string Id, int Number, string Title, IReadOnlyList<LessonBlock> Blocks);

/// <summary>A short reference to a lesson, used in lists and prev/next links.</summary>
public sealed record LessonLink(string Slug, int Number, string Title, string Subtitle);

/// <summary>Where a lesson sits within its group.</summary>
public sealed record LessonGroupPosition(string Id, string Title, int Position, int Count);

public sealed record LessonDetail(
    string Slug,
    int Number,
    string Title,
    string Subtitle,
    IReadOnlyList<InlineSpan> Summary,
    int Minutes,
    LessonGroupPosition Group,
    IReadOnlyList<LessonSection> Sections,
    LessonLink? Previous,
    LessonLink? Next);

public sealed record CourseGroup(string Id, string Title, IReadOnlyList<LessonLink> Lessons);

public sealed record CourseOutline(IReadOnlyList<CourseGroup> Groups);
