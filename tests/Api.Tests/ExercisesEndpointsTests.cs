using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using PolishApp.Api.Features.Exercises;

namespace PolishApp.Api.Tests;

/// <summary>Runs against the real content/exercises bank.</summary>
public sealed class ExercisesEndpointsTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Lists_lessons_with_exercises()
    {
        var sets = await _client.GetFromJsonAsync<ExerciseSetsResponse>("/api/exercises", Json, TestContext.Current.CancellationToken);

        Assert.NotNull(sets);
        Assert.Equal(["mianownik", "dopelniacz"], sets.Sets.Select(s => s.Lesson).ToArray());
        Assert.All(sets.Sets, s => Assert.True(s.Count >= ExerciseBank.SessionSize));
    }

    [Fact]
    public async Task Session_has_ten_exercises_of_the_lesson()
    {
        var session = await _client.GetFromJsonAsync<SessionResponse>(
            "/api/exercises/session?lesson=dopelniacz", Json, TestContext.Current.CancellationToken);

        Assert.NotNull(session);
        Assert.Equal(ExerciseBank.SessionSize, session.Exercises.Count);
        Assert.All(session.Exercises, e => Assert.Equal("dopelniacz", e.Lesson));
    }

    [Fact]
    public async Task Session_json_never_contains_answers()
    {
        var json = await _client.GetStringAsync("/api/exercises/session?ids=dop-01", TestContext.Current.CancellationToken);

        Assert.DoesNotContain("sklepu", json, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Check_returns_the_verdict_and_the_correction()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/exercises/dop-01/check", new CheckRequest(["sklepa"]), Json, TestContext.Current.CancellationToken);
        var result = await response.Content.ReadFromJsonAsync<CheckResponse>(Json, TestContext.Current.CancellationToken);

        Assert.NotNull(result);
        Assert.Equal(Verdict.Wrong, result.Verdict);
        Assert.Equal("sklepu", Assert.Single(result.Answers).Expected);
    }

    [Theory]
    [InlineData("/api/exercises/session", HttpStatusCode.BadRequest)]
    [InlineData("/api/exercises/session?lesson=nope", HttpStatusCode.NotFound)]
    [InlineData("/api/exercises/session?ids=nope", HttpStatusCode.NotFound)]
    public async Task Bad_session_requests_return_problem_details(string url, HttpStatusCode status)
    {
        var response = await _client.GetAsync(url, TestContext.Current.CancellationToken);

        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Check_rejects_a_wrong_number_of_answers()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/exercises/dop-01/check", new CheckRequest(["a", "b"]), Json, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
