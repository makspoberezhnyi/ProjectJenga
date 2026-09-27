import { Scene, NullEngine, SceneLoader } from "@babylonjs/core";
import "@babylonjs/loaders";

const engine = new NullEngine();
const scene = new Scene(engine);
SceneLoader.LoadAssetContainerAsync("/models/", "left_hand.glb", scene).then(c => {
    const i = c.instantiateModelsToScene();
    const root = i.rootNodes[0];
    const boundingInfo = root.getHierarchyBoundingVectors();
    console.log("Min:", boundingInfo.min);
    console.log("Max:", boundingInfo.max);
    console.log("Center:", boundingInfo.min.add(boundingInfo.max).scale(0.5));
});
