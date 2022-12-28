# syntax=docker/dockerfile:1.4
FROM mcr.microsoft.com/dotnet/sdk:7.0 AS build
WORKDIR /src
COPY . .
RUN --mount=type=cache,target=/root/.nuget/packages dotnet restore

FROM mcr.microsoft.com/dotnet/aspnet:7.0-alpine AS base
WORKDIR /app
EXPOSE 80
ENTRYPOINT ["dotnet", "SimpleDemoApi.dll"]

FROM build AS publish-release
COPY . .
RUN --mount=type=cache,target=/root/.nuget/packages dotnet publish -c Release -o /out/release --no-restore

FROM base AS release
COPY --from=publish-release /out/release .
