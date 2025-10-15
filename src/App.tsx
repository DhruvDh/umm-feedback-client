import { Route, Routes } from "@solidjs/router";
import { Component, lazy } from "solid-js";
import Prompts from "./components/Prompts";
import Submissions from "./components/Submissions";
import StreamingTest from "./components/StreamingTest";
const Feedback = lazy(() => import("./components/Feedback"));

const NotFound: Component = () => (
  <article class="mx-auto p-4 prose max-w-3xl">
    <h1>Page Not Found</h1>
    <p>The page you requested doesn’t exist or the link is invalid.</p>
  </article>
);

const App: Component = () => {
  return (
    <Routes>
      <Route path="/" component={NotFound} />
      <Route path="/test" component={StreamingTest} />
      <Route path="/prompts/:id" component={Prompts} />
      <Route path="/submissions/:id" component={Submissions} />
      <Route path="/:id" component={Feedback} />
      <Route path="/*all" component={NotFound} />
    </Routes>
  );
};

export default App;
