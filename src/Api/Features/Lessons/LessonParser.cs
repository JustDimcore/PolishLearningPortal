using System.Text;
using System.Text.RegularExpressions;
using Markdig;
using Markdig.Extensions.Tables;
using Markdig.Extensions.Yaml;
using Markdig.Syntax.Inlines;
using YamlDotNet.Core;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using Md = Markdig.Syntax;

namespace PolishApp.Api.Features.Lessons;

/// <summary>A problem found in a content file. <paramref name="Line"/> is 1-based, 0 when unknown.</summary>
internal sealed record ContentError(string File, int Line, string Message)
{
    public override string ToString() => Line > 0 ? $"{File}:{Line}: {Message}" : $"{File}: {Message}";
}

/// <summary>A lesson as written in its file, before it is placed into the course.</summary>
internal sealed record LessonDocument(
    string Slug,
    string Title,
    string Subtitle,
    IReadOnlyList<InlineSpan> Summary,
    int Minutes,
    IReadOnlyList<LessonSection> Sections);

/// <summary>
/// Parses a lesson Markdown file (format: content/README.md) into structured blocks.
/// Anything outside the supported subset is reported as an error instead of being passed through.
/// </summary>
internal static partial class LessonParser
{
    private const string NotePrefix = "↳ ";
    private const string RemarkPrefix = "↑ ";

    private static readonly MarkdownPipeline Pipeline = new MarkdownPipelineBuilder()
        .UseYamlFrontMatter()
        .UsePipeTables()
        .Build();

    private static readonly IDeserializer Yaml = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .Build();

    public static LessonDocument? Parse(string file, string markdown, List<ContentError> errors)
    {
        var context = new ParseContext(file, errors);
        var errorsBefore = errors.Count;
        var document = Markdown.Parse(markdown, Pipeline);

        FrontMatter? meta = null;
        var sections = new List<LessonSection>();
        string? sectionTitle = null;
        var blocks = new List<LessonBlock>();

        void CloseSection()
        {
            if (sectionTitle is null)
            {
                return;
            }

            var number = sections.Count + 1;
            if (blocks.Count == 0)
            {
                context.Error(0, $"Section \"{sectionTitle}\" is empty");
            }

            sections.Add(new LessonSection($"section-{number}", number, sectionTitle, [.. blocks]));
            blocks.Clear();
        }

        foreach (var block in document)
        {
            var line = block.Line + 1;

            if (block is YamlFrontMatterBlock yaml)
            {
                meta = ParseFrontMatter(yaml, context);
                continue;
            }

            if (block is Md.HeadingBlock heading)
            {
                if (heading.Level != 2)
                {
                    context.Error(line, "Only level-2 headings (##) are allowed; they start sections");
                    continue;
                }

                CloseSection();
                sectionTitle = PlainText(heading.Inline).Trim();
                if (sectionTitle.Length == 0)
                {
                    context.Error(line, "Section title is empty");
                }

                continue;
            }

            if (sectionTitle is null)
            {
                context.Error(line, "Content before the first section; put the introduction into 'summary'");
                continue;
            }

            if (ParseBlock(block, context) is { } parsed)
            {
                blocks.Add(parsed);
            }
        }

        CloseSection();

        if (meta is null)
        {
            context.Error(1, "Missing front matter");
            return null;
        }

        var expectedSlug = Path.GetFileNameWithoutExtension(file);
        if (meta.Slug != expectedSlug)
        {
            context.Error(1, $"Slug \"{meta.Slug}\" must match the file name \"{expectedSlug}\"");
        }

        RequireText(meta.Title, "title", context);
        RequireText(meta.Subtitle, "subtitle", context);
        RequireText(meta.Summary, "summary", context);
        if (meta.Minutes is < 1 or > 120)
        {
            context.Error(1, "'minutes' must be between 1 and 120");
        }

        if (sections.Count == 0)
        {
            context.Error(0, "A lesson needs at least one section (##)");
        }

        var summary = meta.Summary is { Length: > 0 } text ? ParseInline(text, 1, context) : [];

        return errors.Count > errorsBefore
            ? null
            : new LessonDocument(meta.Slug!, meta.Title!, meta.Subtitle!, summary, meta.Minutes, sections);
    }

    private static FrontMatter? ParseFrontMatter(YamlFrontMatterBlock block, ParseContext context)
    {
        var yaml = string.Join('\n', block.Lines.Lines.Take(block.Lines.Count).Select(l => l.ToString()));
        try
        {
            return Yaml.Deserialize<FrontMatter>(yaml) ?? new FrontMatter();
        }
        catch (YamlException ex)
        {
            // +1 for the opening "---" line.
            context.Error((int)ex.Start.Line + 1, $"Invalid front matter: {ex.InnerException?.Message ?? ex.Message}");
            return null;
        }
    }

    private static void RequireText(string? value, string field, ParseContext context)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            context.Error(1, $"Front matter field '{field}' is required");
        }
    }

    private static LessonBlock? ParseBlock(Md.Block block, ParseContext context)
    {
        var line = block.Line + 1;
        switch (block)
        {
            case Md.ParagraphBlock paragraph:
            {
                var spans = ConvertInline(paragraph.Inline, line, context);
                if (spans.Count > 0 && spans[0].Text.StartsWith(NotePrefix, StringComparison.Ordinal))
                {
                    spans[0] = spans[0] with { Text = spans[0].Text[NotePrefix.Length..] };
                    return new NoteBlock(spans);
                }

                return new ParagraphBlock(spans);
            }

            case Md.ListBlock { IsOrdered: false } list:
                return new BulletListBlock([.. list.Select(item => new RichLine(ListItemContent(item, context)))]);

            case Table table:
                return ParseTable(table, context);

            case Md.FencedCodeBlock fenced:
                return ParseFenced(fenced, context);

            default:
                context.Error(line, $"Unsupported Markdown element: {DescribeBlock(block)}");
                return null;
        }
    }

    private static List<InlineSpan> ListItemContent(Md.Block item, ParseContext context)
    {
        if (item is Md.ListItemBlock { Count: 1 } listItem && listItem[0] is Md.ParagraphBlock paragraph)
        {
            return ConvertInline(paragraph.Inline, paragraph.Line + 1, context);
        }

        context.Error(item.Line + 1, "A list item must be a single line of text");
        return [];
    }

    private static TableBlock? ParseTable(Table table, ParseContext context)
    {
        var rows = new List<(bool IsHeader, RichRow Row)>();
        foreach (var row in table.OfType<Markdig.Extensions.Tables.TableRow>())
        {
            var cells = row.OfType<TableCell>()
                .Select(cell => new RichLine(
                    cell.Count == 1 && cell[0] is Md.ParagraphBlock p
                        ? ConvertInline(p.Inline, p.Line + 1, context)
                        : []))
                .ToList();
            rows.Add((row.IsHeader, new RichRow(cells)));
        }

        if (rows.Count < 2 || !rows[0].IsHeader || rows.Skip(1).Any(r => r.IsHeader))
        {
            context.Error(table.Line + 1, "A table needs exactly one header row and at least one body row");
            return null;
        }

        return new TableBlock(rows[0].Row, [.. rows.Skip(1).Select(r => r.Row)]);
    }

    private static LessonBlock? ParseFenced(Md.FencedCodeBlock block, ParseContext context)
    {
        var firstLine = block.Line + 2; // the line after the opening fence
        var lines = block.Lines.Lines
            .Take(block.Lines.Count)
            .Select((l, i) => (Text: l.ToString().Trim(), Line: firstLine + i))
            .Where(l => l.Text.Length > 0)
            .ToList();

        if (lines.Count == 0)
        {
            context.Error(block.Line + 1, "Block is empty");
            return null;
        }

        var kind = block.Info ?? "";
        var attributes = ParseAttributes(block.Arguments, block.Line + 1, context);

        string? Take(string name)
        {
            var value = attributes.GetValueOrDefault(name);
            attributes.Remove(name);
            return value;
        }

        LessonBlock? result;
        switch (kind)
        {
            case "examples":
                result = new ExamplesBlock([.. lines.Select(l => ParseExample(l.Text, l.Line, context))]);
                break;

            case "dialogue":
                result = ParseDialogue(lines, Take("caption"), context);
                break;

            case "card":
                var title = Take("title");
                if (string.IsNullOrWhiteSpace(title))
                {
                    context.Error(block.Line + 1, "Card needs a title=\"…\" attribute");
                }

                result = new CardBlock(
                    title ?? "",
                    Take("caption"),
                    [.. lines.Select(l => new RichLine(ParseInline(l.Text, l.Line, context)))]);
                break;

            default:
                context.Error(block.Line + 1, $"Unknown block '{kind}'; expected examples, dialogue or card");
                return null;
        }

        foreach (var unknown in attributes.Keys)
        {
            context.Error(block.Line + 1, $"Unknown attribute '{unknown}' for block '{kind}'");
        }

        return result;
    }

    private static ExampleItem ParseExample(string text, int line, ParseContext context)
    {
        var parts = SplitColumns(text);
        if (parts.Length != 3)
        {
            context.Error(line, "An example needs three columns: label | Polish | translation");
            return new ExampleItem("", [], []);
        }

        return new ExampleItem(parts[0], ParseInline(parts[1], line, context), ParseInline(parts[2], line, context));
    }

    private static DialogueBlock ParseDialogue(List<(string Text, int Line)> lines, string? caption, ParseContext context)
    {
        var result = new List<DialogueLine>();
        foreach (var (text, line) in lines)
        {
            if (text.StartsWith(RemarkPrefix, StringComparison.Ordinal))
            {
                if (result.Count == 0 || result[^1].Remark is not null)
                {
                    context.Error(line, "A remark (↑) must follow a dialogue line that has no remark yet");
                    continue;
                }

                result[^1] = result[^1] with { Remark = text[RemarkPrefix.Length..].Trim() };
                continue;
            }

            var parts = SplitColumns(text);
            if (parts.Length > 2)
            {
                context.Error(line, "A dialogue line has at most two columns: Polish | translation");
                continue;
            }

            result.Add(new DialogueLine(
                ParseInline(parts[0], line, context),
                parts.Length == 2 ? ParseInline(parts[1], line, context) : null,
                null));
        }

        return new DialogueBlock(caption, result);
    }

    private static string[] SplitColumns(string text) =>
        text.Split(" | ", StringSplitOptions.TrimEntries);

    private static Dictionary<string, string> ParseAttributes(string? arguments, int line, ParseContext context)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(arguments))
        {
            return result;
        }

        var match = AttributeListPattern().Match(arguments);
        if (!match.Success)
        {
            context.Error(line, "Attributes must look like key=\"value\"");
            return result;
        }

        var keys = match.Groups["key"].Captures;
        var values = match.Groups["value"].Captures;
        for (var i = 0; i < keys.Count; i++)
        {
            result[keys[i].Value] = values[i].Value;
        }

        return result;
    }

    /// <summary>Parses a single line of inline Markdown (used for front matter and block columns).</summary>
    private static List<InlineSpan> ParseInline(string text, int line, ParseContext context)
    {
        var document = Markdown.Parse(text, Pipeline);
        if (document is [Md.ParagraphBlock paragraph])
        {
            return ConvertInline(paragraph.Inline, line, context);
        }

        context.Error(line, $"Expected a single line of text: \"{text}\"");
        return [];
    }

    private static List<InlineSpan> ConvertInline(ContainerInline? root, int line, ParseContext context)
    {
        var raw = new List<(string Text, InlineMark[] Marks)>();
        Collect(root, [], raw, line, context);

        // Merge neighbours with equal marks, then cut out {endings}.
        var merged = new List<(StringBuilder Text, InlineMark[] Marks)>();
        foreach (var (text, marks) in raw)
        {
            if (merged.Count > 0 && merged[^1].Marks.SequenceEqual(marks))
            {
                merged[^1].Text.Append(text);
            }
            else
            {
                merged.Add((new StringBuilder(text), marks));
            }
        }

        var spans = new List<InlineSpan>();
        foreach (var (builder, marks) in merged)
        {
            SplitEndings(builder.ToString(), marks, spans, line, context);
        }

        return spans;
    }

    private static void Collect(
        ContainerInline? container,
        InlineMark[] marks,
        List<(string, InlineMark[])> output,
        int line,
        ParseContext context)
    {
        if (container is null)
        {
            return;
        }

        foreach (var inline in container)
        {
            switch (inline)
            {
                case LiteralInline literal:
                    output.Add((literal.Content.ToString(), marks));
                    break;

                case LineBreakInline:
                    output.Add((" ", marks));
                    break;

                case EmphasisInline emphasis:
                    var mark = emphasis.DelimiterCount >= 2 ? InlineMark.Bold : InlineMark.Italic;
                    Collect(emphasis, marks.Contains(mark) ? marks : [.. marks, mark], output, line, context);
                    break;

                default:
                    context.Error(line, $"Unsupported inline element: {inline.GetType().Name.Replace("Inline", "", StringComparison.Ordinal)}");
                    break;
            }
        }
    }

    private static void SplitEndings(string text, InlineMark[] marks, List<InlineSpan> spans, int line, ParseContext context)
    {
        var position = 0;
        while (position < text.Length)
        {
            var open = text.IndexOf('{', position);
            var close = text.IndexOf('}', position);

            if (open < 0)
            {
                if (close >= 0)
                {
                    context.Error(line, "Unmatched '}'");
                }

                spans.Add(new InlineSpan(text[position..], marks));
                return;
            }

            var end = text.IndexOf('}', open + 1);
            var nested = text.IndexOf('{', open + 1);
            if (end < 0 || (nested >= 0 && nested < end) || (close >= 0 && close < open))
            {
                context.Error(line, "Unbalanced '{…}' ending marker");
                spans.Add(new InlineSpan(text[position..], marks));
                return;
            }

            if (open > position)
            {
                spans.Add(new InlineSpan(text[position..open], marks));
            }

            var ending = text[(open + 1)..end];
            if (ending.Length == 0)
            {
                context.Error(line, "Empty '{}' ending marker");
            }
            else
            {
                spans.Add(new InlineSpan(ending, [.. marks, InlineMark.Ending]));
            }

            position = end + 1;
        }
    }

    private static string PlainText(ContainerInline? inline)
    {
        var builder = new StringBuilder();
        foreach (var literal in inline?.FindDescendants<LiteralInline>() ?? [])
        {
            builder.Append(literal.Content.ToString());
        }

        return builder.ToString();
    }

    private static string DescribeBlock(Md.Block block) => block switch
    {
        Md.QuoteBlock => "quote",
        Md.ListBlock => "ordered list",
        Md.ThematicBreakBlock => "horizontal rule",
        Md.HtmlBlock => "HTML",
        Md.CodeBlock => "indented code",
        _ => block.GetType().Name,
    };

    [GeneratedRegex("""^\s*(?:(?<key>[a-z]+)="(?<value>[^"]*)"\s*)*$""")]
    private static partial Regex AttributeListPattern();

    private sealed record ParseContext(string File, List<ContentError> Errors)
    {
        public void Error(int line, string message) => Errors.Add(new ContentError(File, line, message));
    }

    /// <summary>Lesson front matter; unknown keys are rejected by the deserializer.</summary>
    private sealed class FrontMatter
    {
        public string? Slug { get; set; }
        public string? Title { get; set; }
        public string? Subtitle { get; set; }
        public string? Summary { get; set; }
        public int Minutes { get; set; }
    }
}
