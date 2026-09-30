# UI build
FROM node:26-bookworm@sha256:2aaae6d91f99fee84cfc92da9b52c22a185752d247746052bbc3f961e44478c6 AS ui
RUN apt-get update -y && apt-get install -y build-essential python3 g++
RUN npm install -g node-gyp
# Node 26 ships neither yarn nor corepack; the build drives yarn (packageManager: yarn@4.9.1) via make.
RUN npm install -g corepack@latest && corepack enable
RUN mkdir -p /home/app && chown -R node:node /home/app
WORKDIR /home/app
USER node
COPY --chown=node:node package*.json /home/app/
COPY --chown=node:node yarn.lock /home/app/
COPY --chown=node:node Makefile /home/app/
COPY --chown=node:node tsconfig.json /home/app/
COPY --chown=node:node .parcelrc /home/app/
COPY --chown=node:node .npmrc /home/app/
COPY --chown=node:node .yarn /home/app/.yarn
COPY --chown=node:node .yarnrc.yml /home/app/
RUN make node_modules
COPY --chown=node:node ui /home/app/ui
RUN make ui

# Go build
FROM golang:1.27.1@sha256:e0174e51e81218523251d85d248a90d24c3d5e81543b4f07a5d66229397db190 AS go-build

# Add known_hosts entries for GitHub and GitLab
RUN mkdir ~/.ssh
RUN ssh-keyscan github.com >> ~/.ssh/known_hosts
RUN ssh-keyscan gitlab.com >> ~/.ssh/known_hosts

COPY Makefile /app/
WORKDIR /app
RUN go env -w GOCACHE=/go-cache
RUN --mount=type=cache,target=/gomod-cache \
    go env -w GOMODCACHE=/gomod-cache
COPY go.* /app/
RUN go mod download
COPY core /app/core
COPY pkg /app/pkg
COPY cmd /app/cmd
COPY api /app/api

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
    VERSION="$VERSION" GIT_COMMIT="$COMMIT" BUILD_TIME="$BUILD_DATE" BRANCH="$BRANCH" make gitops-server

#  Distroless
FROM gcr.io/distroless/base@sha256:9e9b50d2048db3741f86a48d939b4e4cc775f5889b3496439343301ff54cdba8 AS runtime
COPY --from=ui /home/app/bin/dist/ /dist/
COPY --from=go-build /app/bin/gitops-server /gitops-server
COPY --from=go-build /root/.ssh/known_hosts /root/.ssh/known_hosts

ENTRYPOINT ["/gitops-server"]
