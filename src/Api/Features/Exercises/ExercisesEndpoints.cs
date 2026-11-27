using Microsoft.AspNetCore.Http.HttpResults;
using PolishApp.Api.Features.Content;
using PolishApp.Api.Features.Lessons;

namespace PolishApp.Api.Features.Exercises;

internal static class ExercisesEndpoints
{
    public static IServiceCollection AddExercises(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton(sp => ExerciseBank.Load(ContentPaths.Root(configuration), sp.GetRequiredService<LessonCatalog>()));
        return services;
    }

    public static IEndpointRouteBuilder MapExercisesEndpoints(this IEndpointRouteBuilder routes)
    {
        var exercises = routes.MapGroup("/exercises").WithTags("Exercises");

        exercises.MapGet("/", (ExerciseBank bank) => TypedResults.Ok(bank.Sets))
            .WithName("GetExerciseSets")
            .WithSummary("Lessons that have exercises");

        exercises.MapGet("/session", Results<Ok<SessionResponse>, ProblemHttpResult> (string? lesson, string? ids, ExerciseBank bank) =>
            {
                if (!string.IsNullOrWhiteSpace(ids))
                {
                    var session = bank.CustomSession(ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
                    return session is null
                        ? TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "Unknown exercise id")
                        : TypedResults.Ok(session);
                }

                if (string.IsNullOrWhiteSpace(lesson))
                {
                    return TypedResults.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Pass 'lesson' or 'ids'");
                }

                return bank.HasLesson(lesson)
                    ? TypedResults.Ok(bank.LessonSession(lesson))
                    : TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "No exercises for this lesson");
            })
            .WithName("StartSession")
            .WithSummary("Up to 10 exercises of a lesson, or the given exercises (ids=a,b,c), in random order")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);

        exercises.MapPost("/{id}/check", Results<Ok<CheckResponse>, ProblemHttpResult> (string id, CheckRequest request, ExerciseBank bank) =>
            {
                if (!bank.TryGet(id, out var gaps))
                {
                    return TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "Exercise not found");
                }

                if (request.Answers.Count != 0 && request.Answers.Count != gaps)
                {
                    return TypedResults.Problem(
                        statusCode: StatusCodes.Status400BadRequest,
                        title: "Wrong number of answers",
                        detail: $"This exercise expects {gaps} answer(s), or none to skip it.");
                }

                return TypedResults.Ok(bank.Check(id, request.Answers));
            })
            .WithName("CheckAnswer")
            .WithSummary("Check answers deterministically; an empty list means \"I don't know\"")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);

        return routes;
    }
}
