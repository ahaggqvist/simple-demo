namespace SimpleDemoApp.Models;

public record Pod
{
    [JsonPropertyName("id")] public string? Id { get; init; }

    [JsonPropertyName("name")] public string? Name { get; init; }

    [JsonPropertyName("nodeName")] public string? NodeName { get; init; }

    [JsonPropertyName("state")] public string? State { get; init; }

    [JsonPropertyName("eventType")] public string? EventType { get; init; }

    [JsonPropertyName("loggedAt")] public string? LoggedAt { get; init; }

    [JsonPropertyName("resourceVersion")] public string? ResourceVersion { get; init; }
}