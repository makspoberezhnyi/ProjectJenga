import { Scene, Engine, NullEngine, SceneLoader } from "@babylonjs/core";
import "@babylonjs/loaders";

const engine = new NullEngine();
const scene = new Scene(engine);
SceneLoader.ImportMeshAsync("", "public/models/", "left_hand.glb", scene).then((result) => {
    console.log("Animation groups:");
    result.animationGroups.forEach(ag => console.log(ag.name));
});
