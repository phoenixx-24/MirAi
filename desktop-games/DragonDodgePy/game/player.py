"""First-person player controller.

Two lateral input modes are supported, chosen per-frame by the caller:
  - "active" (pose-tracker connected): lateral_signal is treated as an
    absolute normalized position in [-1, 1] and the player eases toward it.
  - otherwise (keyboard fallback): lateral_signal is a -1/0/1 direction and
    is integrated as a velocity, like a normal arrow-key controller, with
    a short accel/decel ramp so it doesn't feel like it's snapping.

Vertical movement is real gravity + jump-velocity integration, tuned for
"game feel" rather than a strict physics sim:
  - extra gravity on the way down (a snappier, less floaty fall)
  - reduced gravity right at the top of the arc (a touch of hang-time so
    jumps feel controllable rather than a single ballistic hop)
  - a short jump-input buffer, so a jump pressed a few frames before
    landing still fires the instant you touch down, instead of being
    silently dropped
  - a tiny squash-and-stretch scale on takeoff/landing for visual feedback

Attack input is expected to already be an edge-triggered pulse (True for
exactly one call per press) - see DragonDodgeApp._consume_attack / the
pose tracker's consume_jump for the equivalent pattern. That keeps a held
attack key/button from firing once per frame while airborne.

Crouching/ducking is a separate, purely additive bit of state used to
dodge head-height ("is_high") projectiles - see game/projectile.py. Unlike
jump it's a held signal, not an edge-triggered pulse (see the pose
tracker's is_crouching), and it only applies while grounded so it never
interferes with jump physics or the jump-attack combo above.
"""


class Player:
    SPEED = 6.0
    LATERAL_ACCEL = 26.0          # keyboard mode: how fast we ramp to SPEED
    JUMP_VELOCITY = 8.6
    GRAVITY = -19.0
    FALL_GRAVITY_MULT = 1.55      # extra gravity once vz < 0 (snappy fall)
    APEX_GRAVITY_MULT = 0.55      # reduced gravity near the top of the arc
    APEX_VZ_THRESHOLD = 2.2       # |vz| below this counts as "near apex"
    ARENA_HALF_WIDTH = 4.2
    STAND_Z = 1.0
    ATTACK_GRACE = 0.35           # seconds after leaving the ground during
                                   # which an attack press still counts as
                                   # a jump-attack
    JUMP_BUFFER = 0.12            # seconds a jump press is remembered for
    SQUASH_TIME = 0.16
    DUCK_AMOUNT_MAX = 0.4          # how "low" a full duck counts as
    DUCK_SPEED = 11.0              # ease rate toward the target duck amount

    def __init__(self, render):
        self.node = render.attachNewNode("Player")
        self.node.setPos(0, 0, self.STAND_Z)
        self.vz = 0.0
        self.vx = 0.0
        self.on_floor = True
        self.jump_grace = 0.0
        self.jump_buffer_timer = 0.0
        self.radius = 0.5
        self.squash_timer = 0.0
        self.just_landed = False
        self.just_jumped = False
        self.duck_amount = 0.0

    def update(self, dt, lateral_signal, lateral_active, jump_pressed, attack_pressed,
               crouch_signal, sfx):
        self.just_landed = False
        self.just_jumped = False

        # ---- lateral movement ----
        x = self.node.getX()
        if lateral_active:
            target_x = lateral_signal * self.ARENA_HALF_WIDTH * 0.85
            new_x = x + (target_x - x) * min(1.0, dt * 10.0)
            self.vx = (new_x - x) / dt if dt > 0 else 0.0
            x = new_x
        else:
            target_vx = lateral_signal * self.SPEED
            self.vx += (target_vx - self.vx) * min(1.0, dt * self.LATERAL_ACCEL)
            x += self.vx * dt
        x = max(-self.ARENA_HALF_WIDTH, min(self.ARENA_HALF_WIDTH, x))
        self.node.setX(x)

        # ---- jump buffering ----
        if jump_pressed:
            self.jump_buffer_timer = self.JUMP_BUFFER
        elif self.jump_buffer_timer > 0.0:
            self.jump_buffer_timer -= dt

        if self.jump_grace > 0.0:
            self.jump_grace -= dt

        if self.jump_buffer_timer > 0.0 and self.on_floor:
            self.vz = self.JUMP_VELOCITY
            self.on_floor = False
            self.jump_grace = self.ATTACK_GRACE
            self.jump_buffer_timer = 0.0
            self.just_jumped = True
            self.squash_timer = self.SQUASH_TIME
            sfx.play("jump")

        # ---- vertical physics: gravity tuned for feel, not pure sim ----
        if not self.on_floor:
            gravity = self.GRAVITY
            if self.vz < 0:
                gravity *= self.FALL_GRAVITY_MULT
            elif abs(self.vz) < self.APEX_VZ_THRESHOLD:
                gravity *= self.APEX_GRAVITY_MULT
            self.vz += gravity * dt

        z = self.node.getZ() + self.vz * dt
        if z <= self.STAND_Z:
            z = self.STAND_Z
            if not self.on_floor:
                self.just_landed = True
                self.squash_timer = self.SQUASH_TIME
            self.vz = 0.0
            self.on_floor = True
        self.node.setZ(z)

        self._update_squash(dt)

        # ---- duck/squat (only while grounded - never fights jump physics) ----
        target_duck = self.DUCK_AMOUNT_MAX if (crouch_signal and self.on_floor) else 0.0
        self.duck_amount += (target_duck - self.duck_amount) * min(1.0, dt * self.DUCK_SPEED)

        # ---- jump attack (attack_pressed must already be edge-triggered) ----
        triggered = False
        if attack_pressed and (not self.on_floor or self.jump_grace > 0.0):
            triggered = True
            sfx.play("attack")
        return triggered

    def _update_squash(self, dt):
        if self.squash_timer <= 0.0:
            self.node.setScale(1.0, 1.0, 1.0)
            return
        self.squash_timer = max(0.0, self.squash_timer - dt)
        t = 1.0 - (self.squash_timer / self.SQUASH_TIME)
        amount = (1.0 - t) * 0.18
        if self.just_landed or (self.on_floor and t < 1.0):
            self.node.setScale(1.0 + amount, 1.0, 1.0 - amount)
        else:
            self.node.setScale(1.0 - amount * 0.6, 1.0, 1.0 + amount * 0.6)

    def height_above_ground(self):
        return self.node.getZ() - self.STAND_Z

    def is_airborne(self):
        return not self.on_floor
