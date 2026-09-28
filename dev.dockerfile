FROM ubuntu:26.04@sha256:da6fc2be547864451aa253836dd926da33623312df4a9a243e35dc877c378a78
RUN apt-get update && apt-get install -yq ca-certificates
WORKDIR /app
ADD bin build
ENTRYPOINT /app/build/gitops
