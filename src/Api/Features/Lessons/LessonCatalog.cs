using System.Text;
using YamlDotNet.Core;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace PolishApp.Api.Features.Lessons;

/// <summary>Thrown at startup when the content directory has errors; the message lists all of them.</summary>
internal sealed class ContentValidationException(IReadOnlyList<ContentError> errors)
    : Exception(FormatMessage(errors))
{
    public IReadOnlyList<ContentError> Errors { get; } = errors;

    private static string FormatMessage(IReadOnlyList<ContentError> errors)
    {
        var builder = new StringBuilder($"Content has {errors.Count} error(s):");
        foreach (var error in errors)
        {
            builder.Append("\n  ").Append(error);
        }

        return builder.ToString();
    }
}

/// <summary>All lessons of the course, loaded and validated once at startup.</summary>
internal sealed class LessonCatalog
{
    private const string CourseFile = "course.yaml";
    private const string LessonsDirectory = "lessons";

    private static readonly IDeserializer Yaml = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .Build();

    private readonly Dictionary<string, LessonDetail> _lessons;

    private LessonCatalog(CourseOutline outline, Dictionary<string, LessonDetail> lessons)
    {
        Outline = outline;
        _lessons = lessons;
    }

    public CourseOutline Outline { get; }

    public LessonDetail? Find(string slug) => _lessons.GetValueOrDefault(slug);

    /// <summary>Loads <c>course.yaml</c> and <c>lessons/*.md</c> from <paramref name="contentRoot"/>.</summary>
    /// <exception cref="ContentValidationException">Any file is invalid or the course and the files disagree.</exception>
    public static LessonCatalog Load(string contentRoot)
    {
        var errors = new List<ContentError>();

        var documents = new Dictionary<string, LessonDocument>(StringComparer.Ordinal);
        var lessonsPath = Path.Combine(contentRoot, LessonsDirectory);
        if (Directory.Exists(lessonsPath))
        {
            foreach (var path in Directory.EnumerateFiles(lessonsPath, "*.md").Order(StringComparer.Ordinal))
            {
                var file = $"{LessonsDirectory}/{Path.GetFileName(path)}";
                if (LessonParser.Parse(file, File.ReadAllText(path, Encoding.UTF8), errors) is { } document)
                {
                    documents[document.Slug] = document;
                }
            }
        }
        else
        {
            errors.Add(new ContentError(LessonsDirectory, 0, $"Directory not found under {contentRoot}"));
        }

        var groups = ReadCourse(Path.Combine(contentRoot, CourseFile), errors);
        var catalog = errors.Count == 0 ? Build(groups, documents, errors) : null;

        if (errors.Count > 0)
        {
            throw new ContentValidationException(errors);
        }

        return catalog!;
    }

    private static List<CourseFileGroup> ReadCourse(string path, List<ContentError> errors)
    {
        if (!File.Exists(path))
        {
            errors.Add(new ContentError(CourseFile, 0, "File not found"));
            return [];
        }

        try
        {
            var course = Yaml.Deserialize<CourseFileRoot>(File.ReadAllText(path, Encoding.UTF8));
            return course?.Groups ?? [];
        }
        catch (YamlException ex)
        {
            errors.Add(new ContentError(CourseFile, (int)ex.Start.Line, ex.InnerException?.Message ?? ex.Message));
            return [];
        }
    }

    private static LessonCatalog? Build(
        List<CourseFileGroup> groups,
        Dictionary<string, LessonDocument> documents,
        List<ContentError> errors)
    {
        if (groups.Count == 0)
        {
            errors.Add(new ContentError(CourseFile, 0, "The course has no groups"));
        }

        var groupIds = new HashSet<string>(StringComparer.Ordinal);
        var used = new HashSet<string>(StringComparer.Ordinal);
        var ordered = new List<(CourseFileGroup Group, LessonDocument Lesson, int Position, int Count)>();

        foreach (var group in groups)
        {
            if (string.IsNullOrWhiteSpace(group.Id) || string.IsNullOrWhiteSpace(group.Title))
            {
                errors.Add(new ContentError(CourseFile, 0, "Every group needs 'id' and 'title'"));
                continue;
            }

            if (!groupIds.Add(group.Id))
            {
                errors.Add(new ContentError(CourseFile, 0, $"Duplicate group id '{group.Id}'"));
            }

            var position = 0;
            foreach (var slug in group.Lessons)
            {
                if (!used.Add(slug))
                {
                    errors.Add(new ContentError(CourseFile, 0, $"Lesson '{slug}' is listed more than once"));
                }
                else if (!documents.TryGetValue(slug, out var lesson))
                {
                    errors.Add(new ContentError(CourseFile, 0, $"Lesson '{slug}' has no file {LessonsDirectory}/{slug}.md"));
                }
                else
                {
                    ordered.Add((group, lesson, ++position, group.Lessons.Count));
                }
            }
        }

        foreach (var slug in documents.Keys.Where(s => !used.Contains(s)))
        {
            errors.Add(new ContentError($"{LessonsDirectory}/{slug}.md", 0, $"Lesson is not listed in {CourseFile}"));
        }

        if (errors.Count > 0)
        {
            return null;
        }

        var links = ordered
            .Select((entry, index) => new LessonLink(entry.Lesson.Slug, index + 1, entry.Lesson.Title, entry.Lesson.Subtitle))
            .ToList();

        var lessons = new Dictionary<string, LessonDetail>(StringComparer.Ordinal);
        for (var i = 0; i < ordered.Count; i++)
        {
            var (group, lesson, position, count) = ordered[i];
            lessons[lesson.Slug] = new LessonDetail(
                lesson.Slug,
                links[i].Number,
                lesson.Title,
                lesson.Subtitle,
                lesson.Summary,
                lesson.Minutes,
                new LessonGroupPosition(group.Id!, group.Title!, position, count),
                lesson.Sections,
                i > 0 ? links[i - 1] : null,
                i < links.Count - 1 ? links[i + 1] : null);
        }

        var outline = new CourseOutline([
            .. groups.Select(g => new CourseGroup(
                g.Id!,
                g.Title!,
                [.. links.Where(l => g.Lessons.Contains(l.Slug))])),
        ]);

        return new LessonCatalog(outline, lessons);
    }

    private sealed class CourseFileRoot
    {
        public List<CourseFileGroup> Groups { get; set; } = [];
    }

    private sealed class CourseFileGroup
    {
        public string? Id { get; set; }
        public string? Title { get; set; }
        public List<string> Lessons { get; set; } = [];
    }
}
