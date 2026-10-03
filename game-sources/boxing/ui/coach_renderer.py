"""
ui/coach_renderer.py - Clean Procedural 2D Animated Coach Alex (Single Model, No Extra Ghost Limbs)
"""
import math
import pygame
from config import (
    COACH_BODY, COACH_GLOVE, COACH_HEAD,
    ACCENT_CYAN, ACCENT_ORANGE, ACCENT_GREEN, TEXT_MUTED, BG_SURFACE, BORDER_COLOR
)

class CoachRenderer:
    def __init__(self, origin_x: int = 1040, origin_y: int = 340):
        self.origin_x = origin_x
        self.origin_y = origin_y
        self.current_anim = "guard_stance"
        self.anim_time = 0.0
        self.speed_multiplier = 1.0
        self.is_demonstrating = True
        self.show_side_view = False
        self.show_ghost = False  # Strictly disabled to prevent extra phantom hands/torso

        # Joint coordinates relative to origin (center chest)
        self.head = (0, -110)
        self.neck = (0, -75)
        self.sternum = (0, -35)
        self.pelvis = (0, 35)

        self.left_shoulder = (-38, -65)
        self.right_shoulder = (32, -60)
        self.left_elbow = (-35, -20)
        self.right_elbow = (28, -15)
        self.left_wrist = (-18, -85)  # Near cheek
        self.right_wrist = (18, -80)  # Near cheek

        self.left_hip = (-22, 40)
        self.right_hip = (22, 40)
        self.left_knee = (-28, 95)
        self.right_knee = (26, 95)
        self.left_foot = (-38, 150)
        self.right_foot = (35, 150)

    def set_animation(self, anim_name: str, slower: bool = False):
        self.current_anim = anim_name
        self.speed_multiplier = 0.6 if slower else 1.0
        self.anim_time = 0.0

    def toggle_side_view(self):
        self.show_side_view = not self.show_side_view
        return self.show_side_view

    def update(self, dt: float):
        if not self.is_demonstrating:
            return
        self.anim_time += dt * self.speed_multiplier

        t = self.anim_time
        cycle = t % 3.0
        progress = cycle / 3.0

        # Reset base joints
        self.left_shoulder = (-38, -65)
        self.right_shoulder = (32, -60)
        self.left_hip = (-22, 40)
        self.right_hip = (22, 40)
        self.left_knee = (-28, 95)
        self.right_knee = (26, 95)
        self.left_foot = (-38, 150)
        self.right_foot = (35, 150)

        if self.current_anim == "guard_stance":
            # Gentle rhythmic breathing
            sway = math.sin(t * 2.5) * 4.0
            bob = math.cos(t * 2.5) * 2.5
            self.head = (sway * 0.4, -110 + bob)
            self.sternum = (sway * 0.2, -35 + bob * 0.5)
            self.left_wrist = (-18 + sway * 0.3, -85 + bob)
            self.right_wrist = (18 + sway * 0.3, -80 + bob)
            self.left_elbow = (-35, -20 + bob * 0.5)
            self.right_elbow = (28, -15 + bob * 0.5)

        elif self.current_anim == "step_forward_back":
            step_offset = 0.0
            if progress < 0.4:
                p = progress / 0.4
                step_offset = 35.0 * p
            elif progress < 0.7:
                step_offset = 35.0
            else:
                p = (progress - 0.7) / 0.3
                step_offset = 35.0 * (1.0 - p)

            self.left_foot = (-38, 150 - step_offset * 0.5)
            self.head = (0, -110 + math.sin(progress * math.pi * 2) * 4.0)
            self.left_wrist = (-18, -85)
            self.right_wrist = (18, -80)

        elif self.current_anim == "lead_jab":
            if progress < 0.32:
                p = progress / 0.32
                self.left_wrist = (-18 - 110.0 * p, -85 - 15.0 * p)
                self.left_elbow = (-35 - 55.0 * p, -20 - 45.0 * p)
            elif progress < 0.60:
                p = (progress - 0.32) / 0.28
                self.left_wrist = (-128 + 110.0 * p, -100 + 15.0 * p)
                self.left_elbow = (-90 + 55.0 * p, -65 + 45.0 * p)
            else:
                self.left_wrist = (-18, -85)
                self.left_elbow = (-35, -20)
            self.right_wrist = (18, -80)

        elif self.current_anim == "rear_cross":
            if progress < 0.32:
                p = progress / 0.32
                self.right_wrist = (18 + 110.0 * p, -80 - 15.0 * p)
                self.right_elbow = (28 + 55.0 * p, -15 - 45.0 * p)
                self.sternum = (10.0 * p, -35)
            elif progress < 0.60:
                p = (progress - 0.32) / 0.28
                self.right_wrist = (128 - 110.0 * p, -95 + 15.0 * p)
                self.right_elbow = (83 - 55.0 * p, -60 + 45.0 * p)
                self.sternum = (10.0 * (1.0 - p), -35)
            else:
                self.right_wrist = (18, -80)
                self.right_elbow = (28, -15)
                self.sternum = (0, -35)
            self.left_wrist = (-18, -85)

        elif self.current_anim == "combo_one_two":
            if progress < 0.35:
                p = math.sin(progress / 0.35 * math.pi)
                self.left_wrist = (-18 - 100.0 * p, -85 - 12.0 * p)
                self.left_elbow = (-35 - 50.0 * p, -20 - 40.0 * p)
                self.right_wrist = (18, -80)
            elif progress < 0.75:
                p = math.sin((progress - 0.35) / 0.40 * math.pi)
                self.right_wrist = (18 + 105.0 * p, -80 - 15.0 * p)
                self.right_elbow = (28 + 50.0 * p, -15 - 40.0 * p)
                self.sternum = (8.0 * p, -35)
                self.left_wrist = (-18, -85)
            else:
                self.left_wrist = (-18, -85)
                self.right_wrist = (18, -80)
                self.sternum = (0, -35)

        elif self.current_anim == "slip_dodge":
            slip = math.sin(progress * math.pi * 2) * 35.0
            self.head = (slip, -105 + abs(slip) * 0.15)
            self.sternum = (slip * 0.6, -35)
            self.left_wrist = (-18 + slip * 0.8, -85)
            self.right_wrist = (18 + slip * 0.8, -80)

        elif self.current_anim == "freestyle_flow":
            sub_step = int((progress * 4)) % 4
            sub_p = (progress * 4) % 1.0
            p = math.sin(sub_p * math.pi)
            if sub_step == 0:
                self.left_wrist = (-18 - 95.0 * p, -85 - 10.0 * p)
                self.right_wrist = (18, -80)
            elif sub_step == 1:
                self.right_wrist = (18 + 100.0 * p, -80 - 12.0 * p)
                self.left_wrist = (-18, -85)
            elif sub_step == 2:
                self.head = (30.0 * p, -105)
                self.left_wrist = (-18 + 25.0 * p, -85)
                self.right_wrist = (18 + 25.0 * p, -80)
            else:
                self.head = (-30.0 * p, -105)
                self.left_wrist = (-18 - 25.0 * p, -85)
                self.right_wrist = (18 - 25.0 * p, -80)

    def draw(self, surface: pygame.Surface):
        ox, oy = self.origin_x, self.origin_y

        def project(pt):
            x, y = pt
            if self.show_side_view:
                return (int(ox + y * 0.3 + x * 0.1), int(oy + y))
            return (int(ox + x), int(oy + y))

        # Instructor Card Background Frame
        card_rect = pygame.Rect(ox - 130, oy - 150, 260, 340)
        pygame.draw.rect(surface, BG_SURFACE, card_rect, border_radius=12)
        pygame.draw.rect(surface, BORDER_COLOR, card_rect, width=1, border_radius=12)

        # Card Title
        font_sm = pygame.font.SysFont("Outfit", 12, bold=True) or pygame.font.SysFont("Arial", 12, bold=True)
        title_tag = font_sm.render("INSTRUCTOR DEMO", True, ACCENT_CYAN)
        surface.blit(title_tag, (card_rect.x + 14, card_rect.y + 12))

        # Floor ring shadow
        shadow_rect = pygame.Rect(ox - 65, oy + 145, 130, 16)
        pygame.draw.ellipse(surface, (15, 18, 28), shadow_rect)

        # Draw Skeleton Limbs (Legs)
        p_pelvis = project(self.pelvis)
        p_lk = project(self.left_knee)
        p_rk = project(self.right_knee)
        p_lf = project(self.left_foot)
        p_rf = project(self.right_foot)

        pygame.draw.line(surface, (50, 80, 140), p_pelvis, p_lk, 7)
        pygame.draw.line(surface, (50, 80, 140), p_pelvis, p_rk, 7)
        pygame.draw.line(surface, (40, 70, 130), p_lk, p_lf, 6)
        pygame.draw.line(surface, (40, 70, 130), p_rk, p_rf, 6)

        # Shoes
        pygame.draw.ellipse(surface, (20, 20, 25), (p_lf[0] - 10, p_lf[1] - 5, 20, 10))
        pygame.draw.ellipse(surface, (20, 20, 25), (p_rf[0] - 10, p_rf[1] - 5, 20, 10))

        # Torso
        p_sternum = project(self.sternum)
        pygame.draw.line(surface, COACH_BODY, p_sternum, p_pelvis, 16)

        # Arms
        p_ls = project(self.left_shoulder)
        p_rs = project(self.right_shoulder)
        p_le = project(self.left_elbow)
        p_re = project(self.right_elbow)
        p_lw = project(self.left_wrist)
        p_rw = project(self.right_wrist)

        pygame.draw.line(surface, COACH_BODY, p_ls, p_le, 7)
        pygame.draw.line(surface, COACH_BODY, p_le, p_lw, 6)
        pygame.draw.line(surface, COACH_BODY, p_rs, p_re, 7)
        pygame.draw.line(surface, COACH_BODY, p_re, p_rw, 6)

        # Two Boxing Gloves (NO extra ghost gloves!)
        pygame.draw.circle(surface, COACH_GLOVE, p_lw, 13)
        pygame.draw.circle(surface, (255, 120, 90), (p_lw[0] - 2, p_lw[1] - 2), 3)
        pygame.draw.circle(surface, COACH_GLOVE, p_rw, 13)
        pygame.draw.circle(surface, (255, 120, 90), (p_rw[0] - 2, p_rw[1] - 2), 3)

        # Head & Headgear
        p_head = project(self.head)
        pygame.draw.circle(surface, COACH_HEAD, p_head, 20)
        pygame.draw.arc(surface, (30, 40, 60), (p_head[0] - 22, p_head[1] - 23, 44, 46), 0, math.pi, 4)
        pygame.draw.circle(surface, (20, 20, 20), (p_head[0] - 5, p_head[1] - 2), 2)
        pygame.draw.circle(surface, (20, 20, 20), (p_head[0] + 5, p_head[1] - 2), 2)

        # Mode Badge
        side_text = "SIDE VIEW" if self.show_side_view else "FRONT VIEW"
        tag_surf = font_sm.render(f"COACH ALEX · {side_text}", True, TEXT_MUTED)
        surface.blit(tag_surf, (ox - 70, oy + 165))
