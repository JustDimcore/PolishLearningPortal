using PolishApp.Api.Features.Content;

namespace PolishApp.Api.Features.Lessons;

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
    IReadOnlyList<ContentSection> Sections,
    LessonLink? Previous,
    LessonLink? Next);

public sealed record CourseGroup(string Id, string Title, IReadOnlyList<LessonLink> Lessons);

public sealed record CourseOutline(IReadOnlyList<CourseGroup> Groups);
