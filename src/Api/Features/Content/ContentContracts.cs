using System.Text.Json.Serialization;

namespace PolishApp.Api.Features.Content;

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
public abstract record ContentBlock;

public sealed record ParagraphBlock(IReadOnlyList<InlineSpan> Content) : ContentBlock;

/// <summary>A muted side note that belongs to its section.</summary>
public sealed record NoteBlock(IReadOnlyList<InlineSpan> Content) : ContentBlock;

public sealed record BulletListBlock(IReadOnlyList<RichLine> Items) : ContentBlock;

/// <param name="HasRowHeaders">
/// The first column holds row headers (written as an empty first header cell), e.g. case names in a declension table.
/// </param>
public sealed record TableBlock(RichRow Header, IReadOnlyList<RichRow> Rows, bool HasRowHeaders) : ContentBlock;

/// <summary>Labelled Polish examples with translations.</summary>
public sealed record ExamplesBlock(IReadOnlyList<ExampleItem> Items) : ContentBlock;

/// <param name="Caption">What the dialogue illustrates, shown above it (e.g. which case is used).</param>
public sealed record DialogueBlock(string? Caption, IReadOnlyList<DialogueLine> Lines) : ContentBlock;

/// <summary>A short list on a "paper card" (a shopping list, a menu) shown next to the following block.</summary>
/// <param name="Caption">What the list illustrates, shown above the card (e.g. which case is used).</param>
public sealed record CardBlock(string Title, string? Caption, IReadOnlyList<RichLine> Items) : ContentBlock;

public sealed record RichLine(IReadOnlyList<InlineSpan> Content);

public sealed record RichRow(IReadOnlyList<RichLine> Cells);

public sealed record ExampleItem(string Label, IReadOnlyList<InlineSpan> Text, IReadOnlyList<InlineSpan> Translation);

/// <param name="Remark">A handwritten-style remark about this line, if any.</param>
public sealed record DialogueLine(IReadOnlyList<InlineSpan> Text, IReadOnlyList<InlineSpan>? Translation, string? Remark);

/// <summary>A numbered <c>##</c> section of a content file.</summary>
public sealed record ContentSection(string Id, int Number, string Title, IReadOnlyList<ContentBlock> Blocks);
