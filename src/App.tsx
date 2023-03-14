import { Route, Routes } from "@solidjs/router";
import { Component, lazy } from "solid-js";
const Feedback = lazy(() => import("./components/Feedback"));

const App: Component = () => {
  return (
    <Routes>
      <Route path="/:id" component={Feedback} />
    </Routes>
  );
};

export default App;
