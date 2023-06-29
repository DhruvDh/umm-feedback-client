import { Route, Routes } from "@solidjs/router";
import { Component, lazy } from "solid-js";
import Prompts from "./components/Prompts";
import Submissions from "./components/Submissions";
const Feedback = lazy(() => import("./components/Feedback"));

const App: Component = () => {
  return (
    <Routes>
      <Route path="/prompts/:id" component={Prompts} />
      <Route path="/submissions/:id" component={Submissions} />
      <Route path="/:id" component={Feedback} />
    </Routes>
  );
};

export default App;
