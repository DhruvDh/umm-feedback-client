import { Router } from "@solidjs/router";
import { mount, StartClient } from "solid-start/entry-client";

mount(
  () => (
    <Router>
      <StartClient />
    </Router>
  ),
  document
);
