"""Simple kinematic projectile: real velocity integration, sphere-radius
based collision.

Two dodge types, matching the two body movements the pose tracker can
detect:
  - "is_low" (ground-height): can be cleared by jumping.
  - "is_high" (head-height): aimed at the player's head, can be cleared by
    ducking/squatting instead - jumping doesn't help here, ducking does.
Neither flag changes the base collision rule: any sphere that isn't
cleared and reaches the player ends the run (see DragonDodgeApp.
_update_projectiles), whether it's a ground sphere or a head-height one.

Adaptive steering
------------------
A Projectile can optionally be given `target_x_fn`, a zero-arg callable
returning the player's *current* x position. When present, the sphere's
lateral velocity is continuously eased toward that live target every
frame (see update()) instead of only being aimed once at spawn time - so
a player who steps left/right mid-flight actually changes where the
sphere is heading, not just where it started. `steer_rate` controls how
quickly it turns (a blend factor per second, not an instant snap) and
`max_turn_speed` caps how much lateral speed steering alone can add, so
the ball still reads as "tracking", never as teleporting onto the
player. Forward (Y) speed is never touched by steering.
"""

from panda3d.core import Vec3

from .geometry import make_sphere

# Default steering aggressiveness for any projectile that opts into
# target-tracking via `target_x_fn` (see DragonDodgeApp for how it's wired
# to the player's live x position). Centralized here so it's one place to
# tune rather than a magic number buried in update().
STEERING_RATE = 3.0


class Projectile:
    def __init__(self, parent, pos, velocity, color, radius=0.35,
                 is_low=False, low_clear_height=0.30,
                 is_high=False, head_clear_duck=0.18,
                 target_x_fn=None, steer_rate=STEERING_RATE, max_turn_speed=None):
        self.node = parent.attachNewNode("Projectile")
        self.node.setPos(pos)
        self.velocity = velocity
        self.radius = radius
        self.is_low = is_low
        self.low_clear_height = low_clear_height
        self.is_high = is_high
        self.head_clear_duck = head_clear_duck
        self.passed = False
        self._destroyed = False

        self.target_x_fn = target_x_fn
        self.steer_rate = steer_rate
        forward_speed = abs(velocity.getY())
        # Cap steering-added lateral speed relative to the ball's own
        # forward speed so it curves toward the player instead of ever
        # being able to instantly snap onto them.
        self.max_turn_speed = max_turn_speed if max_turn_speed is not None else forward_speed * 0.7

        visual = make_sphere(radius, color)
        visual.reparentTo(self.node)
        visual.setLightOff()
        visual.setColorOff()
        visual.setColor(*color)

    def is_alive(self):
        return not self._destroyed and self.node is not None and not self.node.isEmpty()

    def update(self, dt):
        if not self.is_alive():
            return None

        if self.target_x_fn is not None:
            self._steer_toward_target(dt)

        self.node.setPos(self.node.getPos() + self.velocity * dt)
        if self.node.getY() < -6.0 and not self.passed:
            self.passed = True
            return "dodged"
        return None

    def _steer_toward_target(self, dt):
        """Continuously bend this frame's velocity toward the live target
        x, using a rate-limited blend rather than jumping straight to the
        ideal heading - see module docstring."""
        target_x = self.target_x_fn()
        dx = target_x - self.node.getX()
        desired_vx = max(-self.max_turn_speed, min(self.max_turn_speed, dx * self.steer_rate))
        vx = self.velocity.getX()
        vx += (desired_vx - vx) * min(1.0, self.steer_rate * dt)
        self.velocity = Vec3(vx, self.velocity.getY(), self.velocity.getZ())

    def clears_via_jump(self, player_height_above_ground):
        return self.is_low and player_height_above_ground > self.low_clear_height

    def clears_via_duck(self, player_duck_amount):
        return self.is_high and player_duck_amount > self.head_clear_duck

    def destroy(self):
        if self._destroyed:
            return
        self._destroyed = True
        if self.node is not None and not self.node.isEmpty():
            self.node.removeNode()
