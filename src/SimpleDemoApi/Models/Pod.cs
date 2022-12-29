namespace SimpleDemoApi.Models;

public record Pod
{
    [JsonPropertyName("id")] public string? Id { get; init; }

    [JsonPropertyName("name")] public string? Name { get; init; }

    [JsonPropertyName("nodeName")] public string? NodeName { get; init; }

    [JsonPropertyName("loggedAt")] public string? LoggedAt { get; init; }

    [JsonPropertyName("resourceVersion")] public string? ResourceVersion { get; init; }

    [JsonPropertyName("envVars")] public Dictionary<string, string>? EnvVars { get; init; }
}