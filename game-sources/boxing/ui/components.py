"""
ui/components.py - Reusable Glassmorphic UI Widgets for Pygame
"""
import pygame
from config import (
    BG_SURFACE, BG_SURFACE_LIGHT, BORDER_COLOR, BORDER_HIGHLIGHT,
    ACCENT_CYAN, ACCENT_GREEN, ACCENT_AMBER, ACCENT_RED,
    TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED
)

class Button:
    def __init__(self, rect: tuple, text: str, font, bg_color=BG_SURFACE, 
                 hover_color=BG_SURFACE_LIGHT, border_color=BORDER_COLOR, 
                 text_color=TEXT_PRIMARY, radius=8, icon=None):
        self.rect = pygame.Rect(rect)
        self.text = text
        self.font = font
        self.bg_color = bg_color
        self.hover_color = hover_color
        self.border_color = border_color
        self.text_color = text_color
        self.radius = radius
        self.icon = icon
        self.is_hovered = False
        self.is_active = False
        self.visible = True

    def draw(self, surface: pygame.Surface):
        if not self.visible:
            return

        fill_color = self.hover_color if self.is_hovered else self.bg_color
        border_col = BORDER_HIGHLIGHT if (self.is_hovered or self.is_active) else self.border_color

        # Draw filled background
        pygame.draw.rect(surface, fill_color, self.rect, border_radius=self.radius)
        # Draw border
        pygame.draw.rect(surface, border_col, self.rect, width=1, border_radius=self.radius)

        # Draw label
        label_surf = self.font.render(self.text, True, self.text_color)
        text_rect = label_surf.get_rect(center=self.rect.center)
        surface.blit(label_surf, text_rect)

    def handle_event(self, event: pygame.event.Event) -> bool:
        if not self.visible:
            return False
        if event.type == pygame.MOUSEMOTION:
            self.is_hovered = self.rect.collidepoint(event.pos)
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.rect.collidepoint(event.pos):
                return True
        return False


class MetricPill:
    def __init__(self, rect: tuple, label: str, value: str, font_sm, font_lg,
                 accent_color=ACCENT_CYAN, highlight=False):
        self.rect = pygame.Rect(rect)
        self.label = label
        self.value = value
        self.font_sm = font_sm
        self.font_lg = font_lg
        self.accent_color = accent_color
        self.highlight = highlight

    def set_value(self, val: str):
        self.value = str(val)

    def draw(self, surface: pygame.Surface):
        bg = BG_SURFACE_LIGHT if self.highlight else BG_SURFACE
        border_col = self.accent_color if self.highlight else BORDER_COLOR

        pygame.draw.rect(surface, bg, self.rect, border_radius=10)
        pygame.draw.rect(surface, border_col, self.rect, width=1, border_radius=10)

        # Label (small, muted)
        lbl_surf = self.font_sm.render(self.label.upper(), True, TEXT_MUTED)
        surface.blit(lbl_surf, (self.rect.x + 12, self.rect.y + 6))

        # Value (bold, bright)
        val_surf = self.font_lg.render(self.value, True, self.accent_color if self.highlight else TEXT_PRIMARY)
        surface.blit(val_surf, (self.rect.x + 12, self.rect.y + 20))


class CheckpointItem:
    def __init__(self, rect: tuple, label: str, icon: str, font):
        self.rect = pygame.Rect(rect)
        self.label = label
        self.icon = icon
        self.font = font
        self.status = False # True = met, False = pending

    def draw(self, surface: pygame.Surface):
        bg = (18, 48, 38) if self.status else (24, 28, 44)
        border = ACCENT_GREEN if self.status else BORDER_COLOR
        txt_col = ACCENT_GREEN if self.status else TEXT_SECONDARY

        pygame.draw.rect(surface, bg, self.rect, border_radius=6)
        pygame.draw.rect(surface, border, self.rect, width=1, border_radius=6)

        display_text = f"{self.icon}  {self.label}"
        text_surf = self.font.render(display_text, True, txt_col)
        rect = text_surf.get_rect(center=self.rect.center)
        surface.blit(text_surf, rect)
