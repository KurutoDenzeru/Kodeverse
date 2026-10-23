// One place registers the scroll plugin, so every section shares the same
// ScrollTrigger instance and no component registers it twice. All motion runs
// through useGSAP, which cleans up after itself when the island unmounts.

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export { gsap, ScrollTrigger, useGSAP };
