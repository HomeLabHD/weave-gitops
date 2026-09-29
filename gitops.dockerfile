ARG FLUX_VERSION=2.4.0
ARG FLUX_CLI=ghcr.io/fluxcd/flux-cli:v$FLUX_VERSION

# Alias for flux
FROM $FLUX_CLI@sha256:a9cb966cddc1a0c56dc0d57dda485d9477dd397f8b45f222717b24663471fd1f AS flux

# Go build
FROM golang:1.27.1@sha256:3680233e3204827fbdc66088528ae6d4b3d034f51d03a99d454f6de034888244 AS go-build

# Add known_hosts entries for GitHub and GitLab
RUN mkdir ~/.ssh
RUN ssh-keyscan github.com >> ~/.ssh/known_hosts
RUN ssh-keyscan gitlab.com >> ~/.ssh/known_hosts

COPY Makefile /app/
COPY tools /app/tools
WORKDIR /app
RUN go env -w GOCACHE=/go-cache
RUN go env -w GOMODCACHE=/gomod-cache
COPY go.* /app/
RUN --mount=type=cache,target=/gomod-cache \
    go mod download
COPY . /app

# These are ARGS are defined here to minimise cache misses
# (cf. https://docs.docker.com/engine/reference/builder/#impact-on-build-caching)
# Version ldflags. StageFreight auto-injects VERSION/COMMIT/BUILD_DATE/BRANCH (from the
# resolved version + commit SHA + branch, with the repo's default branch as the branch
# fallback for tag builds) when the Dockerfile declares these exact ARGs and nothing
# overrides them; git is not in the build context, so forward them to make. Else: v0.0.0.
ARG VERSION="v0.0.0-dev"
ARG COMMIT="_unset_"
ARG BUILD_DATE="_unset_"
ARG BRANCH=""

RUN --mount=type=cache,target=/gomod-cache --mount=type=cache,target=/go-cache \
    VERSION="$VERSION" GIT_COMMIT="$COMMIT" BUILD_TIME="$BUILD_DATE" BRANCH="$BRANCH" make gitops

# Distroless
FROM gcr.io/distroless/base@sha256:9e9b50d2048db3741f86a48d939b4e4cc775f5889b3496439343301ff54cdba8 AS runtime
COPY --from=flux /usr/local/bin/flux /usr/local/bin/flux
COPY --from=go-build /app/bin/gitops /gitops
COPY --from=go-build /root/.ssh/known_hosts /root/.ssh/known_hosts

ENTRYPOINT ["/gitops"]
