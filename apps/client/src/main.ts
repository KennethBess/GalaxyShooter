import "./style.css";
import { App } from "./app";

const root = document.querySelector("#app");
if (!root) {
  throw new Error("App root not found");
}

new App(root);
