# Follow Codex command activity

Open a managed Codex Chat UI session. Its top-right activity card follows host-published commands and child agents; indexed terminal transcripts use a different view.

1. Read the compact card while the conversation remains visible.
2. Select an activity to open the full-height details rail, including matched command output.
3. Select **Back** to return to the compact card. Selected completed commands remain available through the session journal until you return.

## Read the evidence

- **Main agent** requires explicit host ownership. Child commands appear under their reported child agent. Unknown ownership stays **Origin unavailable**.
- The grey model and effort describe the child's **Recorded turn configuration**, not a guessed parent setting or a claim about the provider executing a request.
- Missing model, effort or output is reported as unavailable. Older hosts may omit these optional fields.
- Loss of host contact makes live activity unverifiable; it does not prove that a process exited. This panel does not stop or restart commands.

The panel reuses the existing command detail renderer and keeps the shared background-task strip's filtering unchanged. Command/output correlation uses both producer thread and call identity, so duplicate call IDs in different agents do not share output.
