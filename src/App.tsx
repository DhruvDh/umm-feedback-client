import { Route, Routes } from "@solidjs/router";
import { Component, lazy } from "solid-js";
import Messages from "./components/Messages";
import Prompts from "./components/Prompts";
const Feedback = lazy(() => import("./components/Feedback"));

const App: Component = () => {
  return (
    <Routes>
      <Route path="/prompts/:id" component={Prompts} />
      <Route path="/:id" component={Feedback} />
    </Routes>
  );
};

export default App;
