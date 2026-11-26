using Microsoft.AspNetCore.Http.HttpResults;

namespace PolishApp.Api.Features.Lessons;

internal static class LessonsEndpoints
{
    /// <summary>Registers the lesson catalog. Content is read from <c>Content:Path</c>, by default <c>content/</c> next to the app.</summary>
    public static IServiceCollection AddLessons(this IServiceCollection services, IConfiguration configuration)
    {
        var path = configuration["Content:Path"] ?? Path.Combine(AppContext.BaseDirectory, "content");
        services.AddSingleton(_ => LessonCatalog.Load(path));
        return services;
    }

    public static IEndpointRouteBuilder MapLessonsEndpoints(this IEndpointRouteBuilder routes)
    {
        var lessons = routes.MapGroup("/lessons").WithTags("Lessons");

        lessons.MapGet("/", (LessonCatalog catalog) => TypedResults.Ok(catalog.Outline))
            .WithName("GetCourse")
            .WithSummary("Course outline: lesson groups in order");

        lessons.MapGet("/{slug}", Results<Ok<LessonDetail>, ProblemHttpResult> (string slug, LessonCatalog catalog) =>
                catalog.Find(slug) is { } lesson
                    ? TypedResults.Ok(lesson)
                    : TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "Lesson not found"))
            .WithName("GetLesson")
            .WithSummary("A lesson with its sections and neighbours")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return routes;
    }
}
