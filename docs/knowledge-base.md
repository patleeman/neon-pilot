# Knowledge base sync

The knowledge base can be backed by any git repository that `git clone` can read.

The repository setting accepts SSH remotes, HTTPS remotes, and local repository paths. Local paths are useful when the remote is already configured with the right authentication, because Neon Pilot clones from that path into its managed runtime mirror instead of guessing a GitHub URL or credential mode.

The Knowledge extension stores its managed mirror under the runtime state directory and syncs it through extension backend actions. Git operations run through the extension backend context so process policy stays host-owned while Knowledge-specific state and behavior remain extension-owned.
