# Stage 0: Source Prep - Get all code including submodules
# This stage installs git and manually initializes the submodules,
# creating a complete source tree for subsequent stages to use.
FROM node:22-slim AS source-prep
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN git submodule update --init --recursive


# Stage 1: Base Node.js environment
FROM node:22-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
WORKDIR /app
# Copy the complete source code from the prep stage
COPY --from=source-prep /app .


# Stage 2: Install production dependencies
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile


# Stage 3: Build the application
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install && pnpm run build


# Stage 4: Build Go library
FROM golang:1.24 AS go-base
WORKDIR /app
# Copy the specific submodule library from the source-prep stage
COPY --from=source-prep /app/sharedLibs/go-html-to-md /app/sharedLibs/go-html-to-md

# Install Go dependencies and build parser lib
RUN cd /app/sharedLibs/go-html-to-md && \
    go mod tidy && \
    go build -o html-to-markdown.so -buildmode=c-shared html-to-markdown.go && \
    chmod +x html-to-markdown.so


# Stage 5: Build Rust libraries
FROM rust:1-slim AS rust-base
WORKDIR /app
# Copy the specific submodule libraries from the source-prep stage
COPY --from=source-prep /app/sharedLibs/html-transformer /app/sharedLibs/html-transformer
COPY --from=source-prep /app/sharedLibs/pdf-parser /app/sharedLibs/pdf-parser

# Install Rust dependencies and build transformer lib
RUN cd /app/sharedLibs/html-transformer && \
    cargo build --release && \
    chmod +x target/release/libhtml_transformer.so

# Install Rust dependencies and build PDF parser lib
RUN cd /app/sharedLibs/pdf-parser && \
    cargo build --release && \
    chmod +x target/release/libpdf_parser.so


# Final Stage: Assemble the final image
FROM base
# Copy the built application and production dependencies
COPY --from=build /app/dist /app/dist
COPY --from=prod-deps /app/node_modules /app/node_modules

# Copy the compiled Go and Rust libraries from their build stages
COPY --from=go-base /app/sharedLibs/go-html-to-md/html-to-markdown.so /app/sharedLibs/go-html-to-md/html-to-markdown.so
COPY --from=rust-base /app/sharedLibs/html-transformer/target/release/libhtml_transformer.so /app/sharedLibs/html-transformer/target/release/libhtml_transformer.so
COPY --from=rust-base /app/sharedLibs/pdf-parser/target/release/libpdf_parser.so /app/sharedLibs/pdf-parser/target/release/libpdf_parser.so

# The original Dockerfile installs git in the final stage, which is good practice.
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Start the server by default, this can be overwritten at runtime
EXPOSE 8080

# Make sure the entrypoint script has the correct line endings
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
