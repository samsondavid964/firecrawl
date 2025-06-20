# Stage 0: The Single Source of Truth
# This stage's ONLY job is to clone the repository and its submodules.
# All other stages will copy from this stage, guaranteeing the files exist.
FROM node:22-slim AS source-prep
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --recurse-submodules https://github.com/mendableai/firecrawl.git .


# Stage 1: Base Node.js environment for building
FROM node:22-slim AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
# Copy the complete source code from our prep stage
COPY --from=source-prep /src .
# Install all dependencies and build the entire monorepo
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build


# Stage 2: Build Go library
FROM golang:1.24 AS go-builder
WORKDIR /src
# Copy ONLY the Go module from our prepared source
COPY --from=source-prep /src/sharedLibs/go-html-to-md .
# Build the Go shared library
RUN go mod tidy && \
    go build -o html-to-markdown.so -buildmode=c-shared html-to-markdown.go


# Stage 3: Build Rust libraries
FROM rust:1-slim AS rust-builder
WORKDIR /src
# Copy ONLY the Rust modules from our prepared source
COPY --from=source-prep /src/sharedLibs/html-transformer ./html-transformer
COPY --from=source-prep /src/sharedLibs/pdf-parser ./pdf-parser
# Build the libraries
RUN cd html-transformer && cargo build --release
RUN cd pdf-parser && cargo build --release


# Final Stage: Assemble the final, lean production image
FROM node:22-slim
WORKDIR /app

# Set the environment to production
ENV NODE_ENV=production

# Install production dependencies only
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# Copy the built application code from the builder stage
COPY --from=builder /app .

# Copy the compiled Go and Rust libraries from their respective build stages
COPY --from=go-builder /src/html-to-markdown.so ./sharedLibs/go-html-to-md/
COPY --from=rust-builder /src/html-transformer/target/release/libhtml_transformer.so ./sharedLibs/html-transformer/target/release/
COPY --from=rust-builder /src/pdf-parser/target/release/libpdf_parser.so ./sharedLibs/pdf-parser/target/release/

# Copy the entrypoint script and ensure it's executable
COPY --from=builder /app/docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

# Expose the port and set the entrypoint
EXPOSE 3002
ENTRYPOINT ["./docker-entrypoint.sh"]
