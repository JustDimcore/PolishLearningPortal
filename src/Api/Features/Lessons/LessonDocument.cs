using PolishApp.Api.Features.Content;

namespace PolishApp.Api.Features.Lessons;

/// <summary>A lesson as written in its file, before it is placed into the course.</summary>
internal sealed record LessonDocument(
    string Slug,
    string Title,
    string Subtitle,
    IReadOnlyList<InlineSpan> Summary,
    int Minutes,
    IReadOnlyList<ContentSection> Sections)
{
    /// <summary>Parses a lesson file and validates its front matter. Returns null when any error was reported.</summary>
    public static LessonDocument? Read(string file, string markdown, List<ContentError> errors)
    {
        var errorsBefore = errors.Count;
        var parsed = MarkdownContentParser.Parse<FrontMatter>(file, markdown, errors);
        if (parsed is null)
        {
            return null;
        }

        var meta = parsed.Meta;
        void Error(string message) => errors.Add(new ContentError(file, 1, message));

        var expectedSlug = Path.GetFileNameWithoutExtension(file);
        if (meta.Slug != expectedSlug)
        {
            Error($"Slug \"{meta.Slug}\" must match the file name \"{expectedSlug}\"");
        }

        foreach (var (value, field) in new[] { (meta.Title, "title"), (meta.Subtitle, "subtitle"), (meta.Summary, "summary") })
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                Error($"Front matter field '{field}' is required");
            }
        }

        if (meta.Minutes is < 1 or > 120)
        {
            Error("'minutes' must be between 1 and 120");
        }

        var summary = string.IsNullOrWhiteSpace(meta.Summary)
            ? []
            : MarkdownContentParser.ParseInline(file, 1, meta.Summary, errors);

        return errors.Count > errorsBefore
            ? null
            : new LessonDocument(meta.Slug!, meta.Title!, meta.Subtitle!, summary, meta.Minutes, parsed.Sections);
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
