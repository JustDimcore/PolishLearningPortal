using PolishApp.Api.Features.Content;
using PolishApp.Api.Features.Lessons;

namespace PolishApp.Api.Tests;

public sealed class LessonCatalogTests : IDisposable
{
    private readonly DirectoryInfo _root = Directory.CreateTempSubdirectory("polish-content-");

    public void Dispose() => _root.Delete(recursive: true);

    private void Write(string relativePath, string text)
    {
        var path = Path.Combine(_root.FullName, relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, text);
    }

    private void WriteLesson(string slug) => Write($"lessons/{slug}.md", $"""
        ---
        slug: {slug}
        title: {slug}
        subtitle: s
        summary: s
        minutes: 5
        ---

        ## S

        Text.
        """);

    [Fact]
    public void Links_lessons_across_groups()
    {
        WriteLesson("a");
        WriteLesson("b");
        WriteLesson("c");
        Write("course.yaml", """
            groups:
              - { id: one, title: One, lessons: [a, b] }
              - { id: two, title: Two, lessons: [c] }
            """);

        var catalog = LessonCatalog.Load(_root.FullName);

        var c = catalog.Find("c")!;
        Assert.Equal(3, c.Number);
        Assert.Equal(new LessonGroupPosition("two", "Two", 1, 1), c.Group);
        Assert.Equal("b", c.Previous?.Slug);
        Assert.Null(c.Next);
        Assert.Null(catalog.Find("a")!.Previous);
    }

    [Fact]
    public void Reports_all_mismatches_between_course_and_files()
    {
        WriteLesson("a");
        WriteLesson("orphan");
        Write("course.yaml", """
            groups:
              - { id: one, title: One, lessons: [a, a, missing] }
            """);

        var ex = Assert.Throws<ContentValidationException>(() => LessonCatalog.Load(_root.FullName));

        Assert.Collection(
            ex.Errors,
            e => Assert.Contains("listed more than once", e.Message, StringComparison.Ordinal),
            e => Assert.Contains("has no file", e.Message, StringComparison.Ordinal),
            e => Assert.Equal(("lessons/orphan.md", "Lesson is not listed in course.yaml"), (e.File, e.Message)));
    }

    [Fact]
    public void Invalid_lesson_stops_loading_with_file_and_line()
    {
        Write("lessons/a.md", "---\nslug: a\n---\n\nIntro.");
        Write("course.yaml", "groups:\n  - { id: one, title: One, lessons: [a] }");

        var ex = Assert.Throws<ContentValidationException>(() => LessonCatalog.Load(_root.FullName));

        Assert.Contains("lessons/a.md:5: Content before the first section", ex.Message, StringComparison.Ordinal);
    }
}
