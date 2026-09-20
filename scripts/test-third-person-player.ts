import {
  THIRD_PERSON_PLAYER_HEIGHT,
  thirdPersonMovementDirection,
} from "../src/game/third-person-player";

function assertNear(
  actual: number,
  expected: number,
  label: string,
) {
  if (
    Math.abs(
      actual - expected,
    ) > 0.000001
  ) {
    throw new Error(
      `${label}: expected ${expected}, got ${actual}`,
    );
  }
}

if (
  THIRD_PERSON_PLAYER_HEIGHT !==
  1.8
) {
  throw new Error(
    "Third-person player height must remain 1.80 m in world units.",
  );
}

const forward =
  thirdPersonMovementDirection(
    [0, 1],
    {
      forward: true,
      backward: false,
      left: false,
      right: false,
    },
  );
assertNear(
  forward[0],
  0,
  "forward x",
);
assertNear(
  forward[1],
  1,
  "forward z",
);

const right =
  thirdPersonMovementDirection(
    [0, 1],
    {
      forward: false,
      backward: false,
      left: false,
      right: true,
    },
  );
assertNear(
  right[0],
  1,
  "right x",
);
assertNear(
  right[1],
  0,
  "right z",
);

const diagonal =
  thirdPersonMovementDirection(
    [0, 1],
    {
      forward: true,
      backward: false,
      left: false,
      right: true,
    },
  );
assertNear(
  Math.hypot(
    diagonal[0],
    diagonal[1],
  ),
  1,
  "diagonal normalization",
);

const idle =
  thirdPersonMovementDirection(
    [1, 0],
    {
      forward: false,
      backward: false,
      left: false,
      right: false,
    },
  );
assertNear(
  idle[0],
  0,
  "idle x",
);
assertNear(
  idle[1],
  0,
  "idle z",
);

console.log(
  "Third-person movement test passed.",
);
