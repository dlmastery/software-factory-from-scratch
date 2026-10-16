# Backend guide: containers (Docker or Podman)

A self-hosted way to give each stage a real boundary: its own filesystem, its own user, no host secrets, and a network you control. This is a design guide with sketches, not a tested drop-in.

## Shape

```
prepare():  docker build -t factory-snapshot:<run> .        # repo cloned at baseBranch + setup + claude CLI
create():   docker run -d --name <run>-<label> \
              --network factory-egress \                    # a network whose only exit is an allowlisting proxy
              --cpus 2 --memory 4g --pids-limit 512 \
              --read-only --tmpfs /tmp \                    # optional: writable only where needed
              -v <run>-<label>:/work \                      # a volume seeded from the snapshot
              -e ANTHROPIC_API_KEY \                        # or an apiKeyHelper that fetches a short-lived key
              factory-snapshot:<run> sleep infinity
agent:      docker exec -i <run>-<label> claude -p --output-format json --json-schema ... (prompt on stdin)
test():     docker exec <run>-<label> sh -c "$TEST"
destroy():  docker rm -f <run>-<label>; docker volume rm <run>-<label>
```

## Egress

Put the containers on an internal network whose only route out is an HTTP(S) proxy (Squid, Envoy, or a small Node proxy) that allows only:

- the model API endpoint,
- the package registry, if stages may install dependencies,
- the docs service, with the proxy attaching the docs key (the same idea as `factory-live-docs`).

Git pushes do not need to leave the container: run `commitAndPush` from the runner by fetching the container's work with `docker cp` or a bundle (`git bundle create`), so the GitHub token never enters a container.

## Snapshot speed

Build the snapshot image once per run, with dependencies installed, so stage containers start in about a second. Use a volume per stage seeded from the image (or `docker commit` of a prepared container) instead of re-running `setup`.

## Checklist

Same as the Upstash Box guide: implement the interface in `sandbox.mjs`, run `claude -p` inside the container from `agent.mjs` (`docker exec -i`), register the backend in `factory.mjs` and `config.mjs`, keep every gate in the runner, add the backend to config validation, keep secrets in `secretEnv`, then dry-run with the fake agent before a real run.
