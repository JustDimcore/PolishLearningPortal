using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using PolishApp.Api.Features.Lessons;

namespace PolishApp.Api.Tests;

/// <summary>Runs against the real content/ directory, so it also proves the shipped lessons are valid.</summary>
public sealed class LessonsEndpointsTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Course_lists_lessons_in_order_with_global_numbers()
    {
        var course = await _client.GetFromJsonAsync<CourseOutline>("/api/lessons", Json, TestContext.Current.CancellationToken);

        Assert.NotNull(course);
        var lessons = course.Groups.SelectMany(g => g.Lessons).ToList();
        Assert.NotEmpty(lessons);
        Assert.Equal(Enumerable.Range(1, lessons.Count), lessons.Select(l => l.Number));
        Assert.Equal("mianownik", lessons[0].Slug);
    }

    [Fact]
    public async Task Lesson_has_sections_and_neighbours()
    {
        var lesson = await _client.GetFromJsonAsync<LessonDetail>("/api/lessons/dopelniacz", Json, TestContext.Current.CancellationToken);

        Assert.NotNull(lesson);
        Assert.Equal("Dopełniacz", lesson.Title);
        Assert.NotEmpty(lesson.Sections);
        Assert.Equal("mianownik", lesson.Previous?.Slug);
        Assert.Equal("cases", lesson.Group.Id);
    }

    [Fact]
    public async Task Blocks_are_serialized_with_a_type_discriminator()
    {
        using var json = JsonDocument.Parse(await _client.GetStringAsync("/api/lessons/dopelniacz", TestContext.Current.CancellationToken));

        var types = json.RootElement.GetProperty("sections").EnumerateArray()
            .SelectMany(s => s.GetProperty("blocks").EnumerateArray())
            .Select(b => b.GetProperty("type").GetString())
            .ToHashSet();

        Assert.Superset(new HashSet<string?> { "examples", "table", "note", "card", "dialogue" }, types);
    }

    [Fact]
    public async Task Unknown_lesson_returns_problem_details()
    {
        var response = await _client.GetAsync("/api/lessons/nope", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }
}
