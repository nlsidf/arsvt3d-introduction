// 等待文档加载完成
document.addEventListener('DOMContentLoaded', function() {
    // 初始化代码高亮
    hljs.highlightAll();
    
    // 源代码数据
    const sourceCode = {
        'main.rs': `use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, MouseButton, MouseEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, BorderType, Paragraph, Gauge},
    Terminal,
};
use std::io;
use std::time::{Duration, Instant};
use rand::Rng;

mod vec2;
mod world;
mod camera;
mod renderer;
mod maze_gen;
mod entities;

use vec2::Vec2;
use world::World;
use camera::Camera;
use renderer::Renderer;
use entities::{Item, ItemType, NPC, NPCType};

const TARGET_FPS: u64 = 60;
const FRAME_TIME: Duration = Duration::from_millis(1000 / TARGET_FPS);

#[derive(Clone, Copy, PartialEq)]
enum Button {
    Forward,
    Backward,
    StrafeLeft,
    StrafeRight,
    RotateLeft,
    RotateRight,
    ResetView,
    NewMaze,
}

struct ButtonState {
    button: Button,
    rect: Rect,
    pressed: bool,
    hover: bool,
    press_time: Option<Instant>,
}

impl ButtonState {
    fn new(button: Button) -> Self {
        ButtonState {
            button,
            rect: Rect::default(),
            pressed: false,
            hover: false,
            press_time: None,
        }
    }

    fn is_inside(&self, x: u16, y: u16) -> bool {
        x >= self.rect.x && x < self.rect.x + self.rect.width &&
        y >= self.rect.y && y < self.rect.y + self.rect.height
    }

    fn get_style(&self) -> Style {
        let now = Instant::now();
        let base_color = match self.button {
            Button::Forward | Button::Backward => Color::Cyan,
            Button::StrafeLeft | Button::StrafeRight => Color::Green,
            Button::RotateLeft | Button::RotateRight => Color::Yellow,
            Button::ResetView => Color::LightBlue,
            Button::NewMaze => Color::Magenta,
        };

        if self.pressed {
            if let Some(press_time) = self.press_time {
                let elapsed = now.duration_since(press_time).as_millis();
                if elapsed < 150 {
                    return Style::default()
                        .fg(Color::White)
                        .bg(base_color)
                        .add_modifier(Modifier::BOLD);
                }
            }
        }

        if self.hover {
            Style::default()
                .fg(base_color)
                .add_modifier(Modifier::BOLD | Modifier::UNDERLINED)
        } else {
            Style::default().fg(base_color)
        }
    }

    fn get_label(&self) -> &str {
        match self.button {
            Button::Forward => "▲ Forward",
            Button::Backward => "▼ Back",
            Button::StrafeLeft => "◄ Left",
            Button::StrafeRight => "► Right",
            Button::RotateLeft => "↺ Turn L",
            Button::RotateRight => "↻ Turn R",
            Button::ResetView => "⊡ Level",
            Button::NewMaze => "🔄 New Maze",
        }
    }
}

struct App {
    camera: Camera,
    world: World,
    renderer: Renderer,
    running: bool,
    fps: f64,
    buttons: Vec<ButtonState>,
    mouse_dragging: bool,
    last_mouse_pos: Option<(u16, u16)>,
    animation_frame: usize,
    health: f64,
    steps: u32,
    items: Vec<Item>,
    npcs: Vec<NPC>,
    coins_collected: u32,
    keys_collected: u32,
    monochrome_mode: bool,
    energy_bar_rect: Option<Rect>,
    // 添加用于跟踪持续按压的字段
    pressed_button: Option<Button>,
    button_press_time: Option<Instant>,
    // 添加全屏视角模式相关字段
    fullscreen_mode: bool,
    minimap_rect: Option<Rect>,
}

impl App {
    fn new() -> Self {
        let world = World::new_random();
        let start_pos = world.get_start_position();
        let camera = Camera::new(Vec2::new(start_pos.0, start_pos.1), Vec2::new(-1.0, 0.0));
        let renderer = Renderer::new();

        let buttons = vec![
            ButtonState::new(Button::Forward),
            ButtonState::new(Button::Backward),
            ButtonState::new(Button::StrafeLeft),
            ButtonState::new(Button::StrafeRight),
            ButtonState::new(Button::RotateLeft),
            ButtonState::new(Button::RotateRight),
            ButtonState::new(Button::ResetView),
            ButtonState::new(Button::NewMaze),
        ];

        let mut items = Vec::new();
        let mut npcs = Vec::new();
        
        for _ in 0..8 {
            let mut rng = rand::thread_rng();
            loop {
                let x = rng.gen_range(5..world.width - 5) as f64;
                let y = rng.gen_range(5..world.height - 5) as f64;
                if !world.is_wall(x as i32, y as i32) {
                    items.push(Item::new(x + 0.5, y + 0.5, ItemType::Coin));
                    break;
                }
            }
        }
        
        for _ in 0..2 {
            let mut rng = rand::thread_rng();
            loop {
                let x = rng.gen_range(5..world.width - 5) as f64;
                let y = rng.gen_range(5..world.height - 5) as f64;
                if !world.is_wall(x as i32, y as i32) {
                    items.push(Item::new(x + 0.5, y + 0.5, ItemType::Key));
                    break;
                }
            }
        }

        for npc_type in [NPCType::Wanderer, NPCType::Guard] {
            let mut rng = rand::thread_rng();
            loop {
                let x = rng.gen_range(5..world.width - 5) as f64;
                let y = rng.gen_range(5..world.height - 5) as f64;
                if !world.is_wall(x as i32, y as i32) {
                    npcs.push(NPC::new(x + 0.5, y + 0.5, npc_type));
                    break;
                }
            }
        }

        App {
            camera,
            world,
            renderer,
            running: true,
            fps: 0.0,
            buttons,
            mouse_dragging: false,
            last_mouse_pos: None,
            animation_frame: 0,
            health: 100.0,
            steps: 0,
            items,
            npcs,
            coins_collected: 0,
            keys_collected: 0,
            monochrome_mode: false,  // 默认彩色模式
            energy_bar_rect: None,
            pressed_button: None,
            button_press_time: None,
            fullscreen_mode: false,
            minimap_rect: None,
        }
    }

    fn execute_button_action(&mut self, button: Button) {
        match button {
            Button::Forward => {
                self.camera.move_forward(&self.world, 1.5);
                self.steps += 1;
                self.check_item_collection();
            }
            Button::Backward => {
                self.camera.move_backward(&self.world, 1.5);
                self.steps += 1;
                self.check_item_collection();
            }
            Button::StrafeLeft => {
                self.camera.strafe_left(&self.world, 1.5);
                self.steps += 1;
                self.check_item_collection();
            }
            Button::StrafeRight => {
                self.camera.strafe_right(&self.world, 1.5);
                self.steps += 1;
                self.check_item_collection();
            }
            Button::RotateLeft => self.camera.rotate(-1.5),
            Button::RotateRight => self.camera.rotate(1.5),
            Button::ResetView => {
                self.camera.pitch = 0.0;
                self.camera.z_position = 0.0;
                self.camera.z_velocity = 0.0;
            }
            Button::NewMaze => self.regenerate_maze(),
        }
    }

    fn check_item_collection(&mut self) {
        let pos = self.camera.position;
        for item in &mut self.items {
            if !item.collected && item.distance_to(pos.x, pos.y) < 0.6 {
                item.collected = true;
                match item.item_type {
                    ItemType::Coin => self.coins_collected += 1,
                    ItemType::Key => self.keys_collected += 1,
                    ItemType::Health => self.health = (self.health + 20.0).min(100.0),
                    _ => {}
                }
            }
        }
    }
    
    fn update_npcs(&mut self) {
        let map = self.world.get_map();
        for npc in &mut self.npcs {
            npc.update(map, 1.0 / 30.0);
        }
    }
    
    fn regenerate_maze(&mut self) {
        let current_monochrome = self.monochrome_mode;  // 保存当前模式设置
        
        self.world = World::new_random();
        let start_pos = self.world.get_start_position();
        self.camera.position = Vec2::new(start_pos.0, start_pos.1);
        self.steps = 0;
        self.coins_collected = 0;
        self.keys_collected = 0;
        
        self.items.clear();
        self.npcs.clear();
        
        self.monochrome_mode = current_monochrome;  // 恢复模式设置
        self.energy_bar_rect = None;  // 重置energy条矩形
        
        // 重新生成物品...
    }
}

fn main() -> io::Result<()> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut app = App::new();
    let mut frame_count = 0;
    let mut fps_timer = Instant::now();

    terminal.clear()?;

    while app.running {
        let frame_start = Instant::now();

        app.handle_events()?;
        app.render(&mut terminal)?;

        frame_count += 1;
        if fps_timer.elapsed() >= Duration::from_secs(1) {
            app.fps = frame_count as f64 / fps_timer.elapsed().as_secs_f64();
            frame_count = 0;
            fps_timer = Instant::now();
        }

        let elapsed = frame_start.elapsed();
        if elapsed < FRAME_TIME {
            std::thread::sleep(FRAME_TIME - elapsed);
        }
    }

    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    Ok(())
}`,
        
        'renderer.rs': `use ratatui::{
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, BorderType, Paragraph},
    Frame,
};

use crate::camera::Camera;
use crate::world::{World, WallType};
use crate::entities::{Item, NPC};

pub struct Renderer {
    buffer: Vec<Vec<char>>,
    color_buffer: Vec<Vec<Color>>,
}

impl Renderer {
    pub fn new() -> Self {
        Renderer {
            buffer: Vec::new(),
            color_buffer: Vec::new(),
        }
    }

    fn resize_buffers(&mut self, width: usize, height: usize) {
        if self.buffer.len() != height || (self.buffer.len() > 0 && self.buffer[0].len() != width) {
            self.buffer = vec![vec![' '; width]; height];
            self.color_buffer = vec![vec![Color::Black; width]; height];
        }
    }

    fn clear(&mut self, width: usize, height: usize) {
        self.resize_buffers(width, height);
        
        for y in 0..height {
            for x in 0..width {
                if y < height / 3 {
                    let ceiling_depth = y as f64 / (height as f64 / 3.0);
                    let ceiling_brightness = (0.1 + ceiling_depth * 0.15) as u8;
                    self.buffer[y][x] = match ceiling_brightness {
                        0..=5 => ' ',
                        6..=10 => '·',
                        11..=15 => '░',
                        _ => '▒',
                    };
                    self.color_buffer[y][x] = Color::Rgb(
                        20 + ceiling_brightness,
                        20 + ceiling_brightness,
                        40 + ceiling_brightness * 2
                    );
                } else if y >= height * 2 / 3 {
                    let floor_y = y - height * 2 / 3;
                    let floor_depth = (height / 3) as f64 / (floor_y as f64 + 1.0);
                    let floor_brightness = (1.0 / (1.0 + floor_depth * 0.2)).clamp(0.0, 1.0);
                    
                    let pattern = (x / 2 + floor_y / 2) % 2;
                    let base_char = if pattern == 0 { '▓' } else { '▒' };
                    
                    self.buffer[y][x] = if floor_brightness < 0.2 {
                        ' '
                    } else if floor_brightness < 0.4 {
                        '·'
                    } else if floor_brightness < 0.6 {
                        '░'
                    } else {
                        base_char
                    };
                    
                    self.color_buffer[y][x] = Color::Rgb(
                        (70.0 * floor_brightness) as u8,
                        (55.0 * floor_brightness) as u8,
                        (35.0 * floor_brightness) as u8
                    );
                } else {
                    self.buffer[y][x] = ' ';
                    self.color_buffer[y][x] = Color::Black;
                }
            }
        }
    }

    fn get_char(&self, distance: f64, side: bool, wall_x: f64, y_ratio: f64) -> char {
        let brightness = 1.0 / (1.0 + distance * distance * 0.025);
        let adjusted = if side { brightness * 0.7 } else { brightness };
        
        let brick_x = (wall_x * 4.0) as usize % 4;
        let brick_y = (y_ratio * 6.0) as usize % 6;
        
        let is_mortar_h = brick_y == 0 || brick_y == 3;
        let is_mortar_v = brick_x == 0;
        let is_edge = y_ratio < 0.05 || y_ratio > 0.95;
        
        if adjusted > 0.75 {
            if is_edge {
                '═'
            } else if is_mortar_h || is_mortar_v {
                '░'
            } else {
                '█'
            }
        } else if adjusted > 0.55 {
            if is_mortar_h || is_mortar_v {
                '░'
            } else {
                '▓'
            }
        } else if adjusted > 0.35 {
            if is_mortar_h {
                '·'
            } else {
                '▒'
            }
        } else if adjusted > 0.20 {
            '░'
        } else {
            '·'
        }
    }

    pub fn render(&mut self, frame: &mut Frame, area: Rect, camera: &Camera, world: &World, items: &[Item], npcs: &[NPC], monochrome_mode: bool) {
        let width = area.width.saturating_sub(2) as usize;
        let height = area.height.saturating_sub(2) as usize;
        
        if width == 0 || height == 0 {
            return;
        }
        
        self.clear(width, height);

        let pos = camera.position;
        let dir = camera.direction;
        let plane = camera.plane;
        let horizon_offset = camera.get_horizon_offset();

        for x in 0..width {
            let camera_x = 2.0 * x as f64 / width as f64 - 1.0;
            let ray_dir_x = dir.x + plane.x * camera_x;
            let ray_dir_y = dir.y + plane.y * camera_x;

            let mut map_x = pos.x as i32;
            let mut map_y = pos.y as i32;

            let delta_dist_x = if ray_dir_x.abs() < 1e-10 {
                1e30
            } else {
                (1.0 / ray_dir_x).abs()
            };
            
            let delta_dist_y = if ray_dir_y.abs() < 1e-10 {
                1e30
            } else {
                (1.0 / ray_dir_y).abs()
            };

            let (step_x, mut side_dist_x) = if ray_dir_x < 0.0 {
                (-1, (pos.x - map_x as f64) * delta_dist_x)
            } else {
                (1, (map_x as f64 + 1.0 - pos.x) * delta_dist_x)
            };

            let (step_y, mut side_dist_y) = if ray_dir_y < 0.0 {
                (-1, (pos.y - map_y as f64) * delta_dist_y)
            } else {
                (1, (map_y as f64 + 1.0 - pos.y) * delta_dist_y)
            };

            let mut hit = false;
            let mut side = false;
            let mut iterations = 0;

            while !hit && iterations < 100 {
                if side_dist_x < side_dist_y {
                    side_dist_x += delta_dist_x;
                    map_x += step_x;
                    side = false;
                } else {
                    side_dist_y += delta_dist_y;
                    map_y += step_y;
                    side = true;
                }

                if world.is_wall(map_x, map_y) {
                    hit = true;
                }
                iterations += 1;
            }

            if !hit {
                continue;
            }

            let perp_wall_dist = if !side {
                (side_dist_x - delta_dist_x).max(0.01)
            } else {
                (side_dist_y - delta_dist_y).max(0.01)
            };

            let wall_x = if !side {
                pos.y + perp_wall_dist * ray_dir_y
            } else {
                pos.x + perp_wall_dist * ray_dir_x
            };
            let wall_x = wall_x - wall_x.floor();

            let line_height = ((height as f64 / perp_wall_dist) as usize).min(height * 4);

            let draw_start_base = (height / 2).saturating_sub(line_height / 2);
            let draw_end_base = ((height / 2) + (line_height / 2)).min(height);
            
            let draw_start = ((draw_start_base as i32 + horizon_offset).max(0) as usize).min(height);
            let draw_end = ((draw_end_base as i32 + horizon_offset).max(0) as usize).min(height);

            let wall_type = world.get(map_x, map_y);
            let brightness = 1.0 / (1.0 + perp_wall_dist * perp_wall_dist * 0.03);
            let adjusted_brightness = if side { brightness * 0.65 } else { brightness };

            for y in draw_start..draw_end {
                if y < height && x < width {
                    let y_ratio = (y as f64 - draw_start as f64) / (draw_end - draw_start).max(1) as f64;
                    let ch = self.get_char(perp_wall_dist, side, wall_x, y_ratio);
                    let color = if monochrome_mode {
                        let brightness = adjusted_brightness.clamp(0.2, 1.0);
                        Color::Rgb(
                            (255.0 * brightness) as u8,
                            (255.0 * brightness) as u8,
                            (255.0 * brightness) as u8
                        )
                    } else {
                        self.get_wall_color(wall_type, adjusted_brightness, perp_wall_dist)
                    };
                    self.buffer[y][x] = ch;
                    self.color_buffer[y][x] = color;
                }
            }
        }

        let lines: Vec<Line> = self.buffer.iter().enumerate().map(|(y, row)| {
            let spans: Vec<Span> = row.iter().enumerate().map(|(x, &ch)| {
                Span::styled(
                    ch.to_string(), 
                    Style::default().fg(self.color_buffer[y][x])
                )
            }).collect();
            Line::from(spans)
        }).collect();

        let paragraph = Paragraph::new(lines)
            .block(Block::default()
                .borders(Borders::ALL)
                .border_type(BorderType::Double)
                .title(vec![
                    Span::styled("═══ ", Style::default().fg(Color::DarkGray)),
                    Span::styled("🎮 3D VIEW ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
                    Span::styled("═══", Style::default().fg(Color::DarkGray)),
                ]));
        frame.render_widget(paragraph, area);
    }
}`,
        
        'camera.rs': `use crate::vec2::Vec2;
use crate::world::World;
use std::f64::consts::PI;

pub struct Camera {
    pub position: Vec2,
    pub direction: Vec2,
    pub plane: Vec2,
    pub move_speed: f64,
    pub rot_speed: f64,
    pub pitch: f64,
    pub z_position: f64,
    pub z_velocity: f64,
    pub bob_phase: f64,
}

impl Camera {
    pub fn new(position: Vec2, direction: Vec2) -> Self {
        let direction = direction.normalize();
        let plane = Vec2::new(0.0, 0.66);
        
        Camera {
            position,
            direction,
            plane,
            move_speed: 0.15,
            rot_speed: 0.08,
            pitch: 0.0,
            z_position: 0.0,
            z_velocity: 0.0,
            bob_phase: 0.0,
        }
    }

    pub fn move_forward(&mut self, world: &World, delta: f64) {
        let new_pos = self.position + self.direction * (self.move_speed * delta);
        if !world.is_wall(new_pos.x as i32, self.position.y as i32) {
            self.position.x = new_pos.x;
        }
        if !world.is_wall(self.position.x as i32, new_pos.y as i32) {
            self.position.y = new_pos.y;
        }
        
        self.bob_phase += 0.2;
        
        if self.pitch > 0.1 {
            self.z_velocity += 0.05;
        }
    }

    pub fn move_backward(&mut self, world: &World, delta: f64) {
        let new_pos = self.position - self.direction * (self.move_speed * delta);
        if !world.is_wall(new_pos.x as i32, self.position.y as i32) {
            self.position.x = new_pos.x;
        }
        if !world.is_wall(self.position.x as i32, new_pos.y as i32) {
            self.position.y = new_pos.y;
        }
        
        self.bob_phase += 0.2;
    }

    pub fn strafe_left(&mut self, world: &World, delta: f64) {
        let right = Vec2::new(self.direction.y, -self.direction.x);
        let new_pos = self.position - right * (self.move_speed * delta);
        if !world.is_wall(new_pos.x as i32, self.position.y as i32) {
            self.position.x = new_pos.x;
        }
        if !world.is_wall(self.position.x as i32, new_pos.y as i32) {
            self.position.y = new_pos.y;
        }
        
        self.bob_phase += 0.2;
    }

    pub fn strafe_right(&mut self, world: &World, delta: f64) {
        let right = Vec2::new(self.direction.y, -self.direction.x);
        let new_pos = self.position + right * (self.move_speed * delta);
        if !world.is_wall(new_pos.x as i32, self.position.y as i32) {
            self.position.x = new_pos.x;
        }
        if !world.is_wall(self.position.x as i32, new_pos.y as i32) {
            self.position.y = new_pos.y;
        }
        
        self.bob_phase += 0.2;
    }

    pub fn rotate(&mut self, angle: f64) {
        let rot_angle = angle * self.rot_speed;
        self.direction = self.direction.rotate(rot_angle);
        self.plane = self.plane.rotate(rot_angle);
    }
    
    pub fn rotate_absolute(&mut self, angle: f64) {
        self.direction = self.direction.rotate(angle);
        self.plane = self.plane.rotate(angle);
    }

    pub fn look_up(&mut self, delta: f64) {
        self.pitch = (self.pitch + delta * 0.05).clamp(-PI / 3.0, PI / 3.0);
    }

    pub fn look_down(&mut self, delta: f64) {
        self.pitch = (self.pitch - delta * 0.05).clamp(-PI / 3.0, PI / 3.0);
    }

    pub fn update(&mut self, _delta_time: f64) {
        self.z_velocity -= 0.02;
        self.z_position += self.z_velocity;
        
        if self.z_position < 0.0 {
            self.z_position = 0.0;
            self.z_velocity = 0.0;
        }
        
        self.z_velocity *= 0.95;
    }

    pub fn get_view_bob(&self) -> f64 {
        (self.bob_phase.sin() * 0.08).clamp(-0.12, 0.12)
    }

    pub fn get_horizon_offset(&self) -> i32 {
        let base_offset = (self.pitch * 150.0) as i32;
        let bob_offset = (self.get_view_bob() * 20.0) as i32;
        let jump_offset = (self.z_position * 50.0) as i32;
        
        base_offset + bob_offset + jump_offset
    }
}`,
        
        'world.rs': `use crate::maze_gen::{MazeGenerator, MAP_WIDTH, MAP_HEIGHT};

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum WallType {
    Empty = 0,
    Red = 1,
    Green = 2,
    Blue = 3,
    White = 4,
    Yellow = 5,
}

impl WallType {
    #[allow(dead_code)]
    pub fn color(&self) -> u8 {
        match self {
            WallType::Empty => 0,
            WallType::Red => 1,
            WallType::Green => 2,
            WallType::Blue => 3,
            WallType::White => 4,
            WallType::Yellow => 5,
        }
    }
}

pub struct World {
    map: [[WallType; MAP_HEIGHT]; MAP_WIDTH],
    pub width: usize,
    pub height: usize,
    start_pos: (f64, f64),
}

impl World {
    pub fn new_random() -> Self {
        let mut generator = MazeGenerator::new();
        let map = generator.generate();
        let start_pos = generator.get_start_position();
        
        World { 
            map,
            width: MAP_WIDTH,
            height: MAP_HEIGHT,
            start_pos,
        }
    }

    pub fn get_start_position(&self) -> (f64, f64) {
        self.start_pos
    }

    pub fn get(&self, x: i32, y: i32) -> WallType {
        if x < 0 || y < 0 || x >= MAP_WIDTH as i32 || y >= MAP_HEIGHT as i32 {
            return WallType::Red;
        }
        self.map[x as usize][y as usize]
    }

    pub fn is_wall(&self, x: i32, y: i32) -> bool {
        self.get(x, y) != WallType::Empty
    }
    
    pub fn get_map(&self) -> &[[WallType; MAP_HEIGHT]; MAP_WIDTH] {
        &self.map
    }
}`,
        
        'maze_gen.rs': `use rand::Rng;
use crate::world::WallType;

pub const MAP_WIDTH: usize = 51;
pub const MAP_HEIGHT: usize = 51;

pub struct MazeGenerator {
    map: [[bool; MAP_HEIGHT]; MAP_WIDTH],
}

impl MazeGenerator {
    pub fn new() -> Self {
        MazeGenerator {
            map: [[true; MAP_HEIGHT]; MAP_WIDTH],
        }
    }

    pub fn generate(&mut self) -> [[WallType; MAP_HEIGHT]; MAP_WIDTH] {
        let mut rng = rand::thread_rng();
        
        for x in 0..MAP_WIDTH {
            for y in 0..MAP_HEIGHT {
                self.map[x][y] = true;
            }
        }

        self.carve_path(1, 1, &mut rng);

        let mut result = [[WallType::Empty; MAP_HEIGHT]; MAP_WIDTH];
        
        for x in 0..MAP_WIDTH {
            for y in 0..MAP_HEIGHT {
                if self.map[x][y] {
                    let wall_type = if x == 0 || y == 0 || x == MAP_WIDTH - 1 || y == MAP_HEIGHT - 1 {
                        WallType::Red
                    } else {
                        let pattern = (x / 5 + y / 5) % 5;
                        match pattern {
                            0 => WallType::Red,
                            1 => WallType::Green,
                            2 => WallType::Blue,
                            3 => WallType::White,
                            _ => WallType::Yellow,
                        }
                    };
                    result[x][y] = wall_type;
                }
            }
        }

        result
    }

    fn carve_path(&mut self, x: usize, y: usize, rng: &mut impl Rng) {
        self.map[x][y] = false;

        let mut directions = [(0, -2), (0, 2), (-2, 0), (2, 0)];
        
        for i in (1..directions.len()).rev() {
            let j = rng.gen_range(0..=i);
            directions.swap(i, j);
        }

        for (dx, dy) in directions.iter() {
            let nx = x as i32 + dx;
            let ny = y as i32 + dy;

            if nx > 0 && ny > 0 && nx < (MAP_WIDTH - 1) as i32 && ny < (MAP_HEIGHT - 1) as i32 {
                let nx = nx as usize;
                let ny = ny as usize;

                if self.map[nx][ny] {
                    let mx = (x as i32 + dx / 2) as usize;
                    let my = (y as i32 + dy / 2) as usize;
                    self.map[mx][my] = false;
                    
                    self.carve_path(nx, ny, rng);
                }
            }
        }
    }

    pub fn get_start_position(&self) -> (f64, f64) {
        let mut rng = rand::thread_rng();
        
        loop {
            let x = rng.gen_range(1..MAP_WIDTH - 1);
            let y = rng.gen_range(1..MAP_HEIGHT - 1);
            
            if !self.map[x][y] {
                return (x as f64 + 0.5, y as f64 + 0.5);
            }
        }
    }
}`,
        
        'entities.rs': `use crate::world::WallType;
use rand::Rng;

#[derive(Clone, Copy, PartialEq, Debug)]
#[allow(dead_code)]
pub enum ItemType {
    Coin,
    Key,
    Health,
    Exit,
}

#[derive(Clone, Copy, Debug)]
pub struct Item {
    pub x: f64,
    pub y: f64,
    pub item_type: ItemType,
    pub collected: bool,
}

impl Item {
    pub fn new(x: f64, y: f64, item_type: ItemType) -> Self {
        Item {
            x,
            y,
            item_type,
            collected: false,
        }
    }

    #[allow(dead_code)]
    pub fn get_icon(&self) -> char {
        match self.item_type {
            ItemType::Coin => '◆',
            ItemType::Key => '🔑',
            ItemType::Health => '❤',
            ItemType::Exit => '🚪',
        }
    }

    #[allow(dead_code)]
    pub fn distance_to(&self, x: f64, y: f64) -> f64 {
        let dx = self.x - x;
        let dy = self.y - y;
        (dx * dx + dy * dy).sqrt()
    }
}

#[derive(Clone, Copy, Debug)]
pub struct NPC {
    pub x: f64,
    pub y: f64,
    pub dir_x: f64,
    pub dir_y: f64,
    pub npc_type: NPCType,
    pub animation_phase: f64,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum NPCType {
    Wanderer,
    Guard,
}

impl NPC {
    pub fn new(x: f64, y: f64, npc_type: NPCType) -> Self {
        let mut rng = rand::thread_rng();
        let angle = rng.gen_range(0.0..std::f64::consts::PI * 2.0);
        
        NPC {
            x,
            y,
            dir_x: angle.cos(),
            dir_y: angle.sin(),
            npc_type,
            animation_phase: 0.0,
        }
    }

    pub fn update(&mut self, world_map: &[[WallType; crate::maze_gen::MAP_HEIGHT]; crate::maze_gen::MAP_WIDTH], delta_time: f64) {
        self.animation_phase += delta_time * 3.0;
        
        let speed = match self.npc_type {
            NPCType::Wanderer => 0.02,
            NPCType::Guard => 0.01,
        };

        let new_x = self.x + self.dir_x * speed;
        let new_y = self.y + self.dir_y * speed;

        if world_map[new_x as usize][self.y as usize] == WallType::Empty {
            self.x = new_x;
        } else {
            self.dir_x = -self.dir_x;
        }

        if world_map[self.x as usize][new_y as usize] == WallType::Empty {
            self.y = new_y;
        } else {
            self.dir_y = -self.dir_y;
        }

        if rand::thread_rng().gen_range(0..100) < 2 {
            let angle = rand::thread_rng().gen_range(0.0..std::f64::consts::PI * 2.0);
            self.dir_x = angle.cos();
            self.dir_y = angle.sin();
        }
    }
}`,
        
        'vec2.rs': `use std::ops::{Add, Sub, Mul, Div};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Vec2 {
    pub x: f64,
    pub y: f64,
}

impl Vec2 {
    pub fn new(x: f64, y: f64) -> Self {
        Vec2 { x, y }
    }

    pub fn magnitude(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }

    #[allow(dead_code)]
    pub fn magnitude_squared(&self) -> f64 {
        self.x * self.x + self.y * self.y
    }

    pub fn normalize(&self) -> Self {
        let mag = self.magnitude();
        if mag > 0.0 {
            Vec2 {
                x: self.x / mag,
                y: self.y / mag,
            }
        } else {
            *self
        }
    }

    #[allow(dead_code)]
    pub fn dot(&self, other: &Vec2) -> f64 {
        self.x * other.x + self.y * other.y
    }

    pub fn rotate(&self, angle: f64) -> Self {
        let cos = angle.cos();
        let sin = angle.sin();
        Vec2 {
            x: self.x * cos - self.y * sin,
            y: self.x * sin + self.y * cos,
        }
    }
}

impl Add for Vec2 {
    type Output = Vec2;

    fn add(self, other: Vec2) -> Vec2 {
        Vec2 {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

impl Sub for Vec2 {
    type Output = Vec2;

    fn sub(self, other: Vec2) -> Vec2 {
        Vec2 {
            x: self.x - other.x,
            y: self.y - other.y,
        }
    }
}

impl Mul<f64> for Vec2 {
    type Output = Vec2;

    fn mul(self, scalar: f64) -> Vec2 {
        Vec2 {
            x: self.x * scalar,
            y: self.y * scalar,
        }
    }
}

impl Div<f64> for Vec2 {
    type Output = Vec2;

    fn div(self, scalar: f64) -> Vec2 {
        Vec2 {
            x: self.x / scalar,
            y: self.y / scalar,
        }
    }
}`,
        
        'cargo_toml': `[package]
name = "arsvt3d"
version = "0.1.8"
edition = "2021"
description = "A 3D maze game implemented with Rust and Ratatui"
license = "Apache-2.0"
repository = "https://github.com/nlsidf/arsvt"
homepage = "https://github.com/nlsidf/arsvt"
documentation = "https://github.com/nlsidf/arsvt"

[dependencies]
ratatui = "0.29"
crossterm = "0.27"
rand = "0.8"

[profile.release]
strip = true
lto = true
codegen-units = 1
panic = "abort"`
    };
    
// 加载二进制文件数据
const script = document.createElement('script');
script.src = 'binary_data.js';
document.head.appendChild(script);

script.onload = function() {
    console.log('二进制数据已加载，支持平台数量:', Object.keys(binaryData).length);
};
    
    // 当前选中的文件
    let currentFile = 'main.rs';
    
    // 代码文件切换功能
    const fileItems = document.querySelectorAll('.file-item');
    const codeDisplay = document.getElementById('code-display');
    const fileName = document.getElementById('file-name');
    
    // 初始化显示main.rs
    if (codeDisplay && fileName) {
        codeDisplay.textContent = sourceCode['main.rs'];
        fileName.textContent = 'main.rs';
        hljs.highlightElement(codeDisplay);
    }
    
    // 为文件列表添加点击事件
    fileItems.forEach(item => {
        item.addEventListener('click', function() {
            // 移除所有活动状态
            fileItems.forEach(f => f.classList.remove('active'));
            
            // 添加当前选中状态
            this.classList.add('active');
            
            // 更新代码显示
            const file = this.getAttribute('data-file');
            if (sourceCode[file] && codeDisplay && fileName) {
                codeDisplay.textContent = sourceCode[file];
                fileName.textContent = file;
                hljs.highlightElement(codeDisplay);
            }
        });
    });
    
    // 复制代码功能
    const copyCodeBtn = document.getElementById('copy-code');
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', function() {
            if (codeDisplay) {
                navigator.clipboard.writeText(codeDisplay.textContent)
                    .then(() => {
                        const originalText = this.textContent;
                        this.textContent = '已复制!';
                        setTimeout(() => {
                            this.textContent = originalText;
                        }, 2000);
                    })
                    .catch(err => {
                        console.error('复制失败:', err);
                    });
            }
        });
    }
    
    // 下载源代码功能
    const downloadSourceBtn = document.getElementById('download-source-btn');
    if (downloadSourceBtn) {
        downloadSourceBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // 创建一个包含所有源代码的ZIP文件（这里简化处理，实际项目中可以使用JSZip库）
            let allSourceCode = `# arsvt3d 源代码

## 源代码文件

### main.rs
\`\`\`rust
${sourceCode['main.rs']}
\`\`\`

### renderer.rs
\`\`\`rust
${sourceCode['renderer.rs']}
\`\`\`

### camera.rs
\`\`\`rust
${sourceCode['camera.rs']}
\`\`\`

### world.rs
\`\`\`rust
${sourceCode['world.rs']}
\`\`\`

### maze_gen.rs
\`\`\`rust
${sourceCode['maze_gen.rs']}
\`\`\`

### entities.rs
\`\`\`rust
${sourceCode['entities.rs']}
\`\`\`

### vec2.rs
\`\`\`rust
${sourceCode['vec2.rs']}
\`\`\`

### Cargo.toml
\`\`\`toml
${sourceCode['cargo_toml']}
\`\`\`

## 使用方法

1. 确保已安装 Rust 环境
2. 将以上文件保存到同一目录
3. 运行 \`cargo run --release\`
4. 或者使用 \`cargo install --path .\` 安装到系统

更多信息请访问项目主页：https://github.com/nlsidf/arsvt
`;
            
            // 创建下载链接
            const blob = new Blob([allSourceCode], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'arsvt3d_source.md';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
    
    // 平台选择和二进制下载功能
    const platformSelect = document.getElementById('platform-select');
    const downloadBinaryBtn = document.getElementById('download-binary-btn');
    
    if (platformSelect && downloadBinaryBtn) {
        platformSelect.addEventListener('change', function() {
            downloadBinaryBtn.disabled = !this.value;
        });
        
        downloadBinaryBtn.addEventListener('click', function() {
            const selectedPlatform = platformSelect.value;
            if (!selectedPlatform) return;
            
            // 获取二进制数据
            const binaryBase64 = binaryData[selectedPlatform];
            if (!binaryBase64) {
                alert('该平台的二进制文件暂未提供');
                return;
            }
            
            // 将base64转换为二进制数据
            try {
                const binaryString = atob(binaryBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                // 确定文件名
                let fileName = 'arsvt3d';
                let fileType = 'application/octet-stream';
                
                if (selectedPlatform.includes('windows')) {
                    fileName += '.exe';
                }
                
                // 创建下载链接
                const blob = new Blob([bytes], { type: fileType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (error) {
                alert('二进制数据处理失败: ' + error.message);
                console.error('二进制数据处理失败:', error);
            }
        });
    }
    
    // 下载curl脚本功能
    const downloadScriptBtn = document.getElementById('download-script');
    if (downloadScriptBtn) {
        downloadScriptBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // 创建安装脚本的下载
            fetch('install.sh')
                .then(response => response.text())
                .then(scriptContent => {
                    const blob = new Blob([scriptContent], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'arsvt3d-install.sh';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                })
                .catch(error => {
                    console.error('获取安装脚本失败:', error);
                    alert('获取安装脚本失败: ' + error.message);
                });
        });
    }

    // 复制curl命令功能
    const copyCurlBtn = document.getElementById('copy-curl');
    const curlScript = document.getElementById('curl-script');
    
    if (copyCurlBtn && curlScript) {
        copyCurlBtn.addEventListener('click', function() {
            navigator.clipboard.writeText(curlScript.textContent.trim())
                .then(() => {
                    const originalText = this.textContent;
                    this.textContent = '已复制!';
                    setTimeout(() => {
                        this.textContent = originalText;
                    }, 2000);
                })
                .catch(err => {
                    console.error('复制失败:', err);
                });
        });
    }
    
    // 平滑滚动到锚点
    document.querySelectorAll('nav a, .hero-buttons a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
    
    // 检测用户平台并自动选择对应的下载选项
    function detectPlatform() {
        const userAgent = navigator.userAgent.toLowerCase();
        const platform = navigator.platform.toLowerCase();
        
        if (userAgent.includes('android')) {
            return 'android-arm64';
        } else if (platform.includes('win')) {
            return userAgent.includes('wow64') || userAgent.includes('x64') ? 'windows-x64' : 'windows-x86';
        } else if (platform.includes('mac')) {
            return userAgent.includes('arm') || userAgent.includes('silicon') ? 'macos-arm64' : 'macos-x64';
        } else if (platform.includes('linux')) {
            return userAgent.includes('arm') || userAgent.includes('aarch64') ? 'linux-arm64' : 'linux-x64';
        }
        
        return '';
    }
    
    // 自动检测并选中对应的平台
    const detectedPlatform = detectPlatform();
    if (detectedPlatform && platformSelect) {
        for (let i = 0; i < platformSelect.options.length; i++) {
            if (platformSelect.options[i].value === detectedPlatform) {
                platformSelect.selectedIndex = i;
                platformSelect.dispatchEvent(new Event('change'));
                break;
            }
        }
    }
    
    // 创建curl下载脚本（模拟功能）
    function generateCurlScript() {
        // 这里可以根据实际需求生成curl脚本
        return `#!/bin/bash
# arsvt3d 自动安装脚本

set -e

echo "正在检测您的平台..."

PLATFORM=""
ARCH=""

# 检测操作系统
case "$(uname -s)" in
    Linux*)
        OS="linux"
        ;;
    Darwin*)
        OS="macos"
        ;;
    CYGWIN*|MINGW*|MSYS*)
        OS="windows"
        ;;
    *)
        echo "不支持的操作系统: $(uname -s)"
        exit 1
        ;;
esac

# 检测架构
case "$(uname -m)" in
    x86_64|amd64)
        ARCH="x64"
        ;;
    i386|i686)
        ARCH="x86"
        ;;
    armv7l)
        ARCH="arm"
        ;;
    aarch64|arm64)
        ARCH="arm64"
        ;;
    *)
        echo "不支持的架构: $(uname -m)"
        exit 1
        ;;
esac

# 检测Android
if [ -f /system/build.prop ] || [ -d /system/app ]; then
    OS="android"
    ARCH="arm64"
fi

echo "检测到平台: $OS-$ARCH"

# 下载对应平台的二进制文件
FILENAME="arsvt3d"
if [ "$OS" = "windows" ]; then
    FILENAME="arsvt3d.exe"
fi

# 这里是示例URL，实际使用时需要替换为真实的下载地址
DOWNLOAD_URL="https://github.com/nlsidf/arsvt/releases/latest/download/arsvt3d-$OS-$ARCH"

echo "正在从 $DOWNLOAD_URL 下载..."

# 使用curl或wget下载
if command -v curl >/dev/null 2>&1; then
    curl -L -o "$FILENAME" "$DOWNLOAD_URL"
elif command -v wget >/dev/null 2>&1; then
    wget -O "$FILENAME" "$DOWNLOAD_URL"
else
    echo "错误: 需要安装 curl 或 wget"
    exit 1
fi

# 设置执行权限
if [ "$OS" != "windows" ]; then
    chmod +x "$FILENAME"
fi

echo "安装完成! 运行 ./$FILENAME 开始游戏"
`;
    }
    
    // 这里可以添加更多功能，如生成安装脚本等
    console.log('arsvt3d 项目介绍网站已加载');
    
    // 图片懒加载优化
    function lazyLoadImages() {
        const lazyImages = document.querySelectorAll('img[loading="lazy"]');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src || img.src;
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                });
            });
            
            lazyImages.forEach(img => {
                imageObserver.observe(img);
            });
        } else {
            // 降级方案：直接加载所有图片
            lazyImages.forEach(img => {
                img.src = img.dataset.src || img.src;
                img.classList.remove('lazy');
            });
        }
    }
    
    // 初始化懒加载
    lazyLoadImages();
    
    // 图片加载错误处理
    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', function() {
            // 如果图片加载失败，显示错误信息
            this.style.display = 'none';
            const errorDiv = document.createElement('div');
            errorDiv.className = 'image-error';
            errorDiv.innerHTML = '图片加载失败';
            errorDiv.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                height: 200px;
                background-color: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 4px;
                color: #6c757d;
                font-family: inherit;
            `;
            this.parentNode.insertBefore(errorDiv, this.nextSibling);
        });
    });
    
    // 在线预览功能
    const startDemoBtn = document.getElementById('start-demo');
    const iframeOverlay = document.getElementById('iframe-overlay');
    const demoFrame = document.getElementById('demo-frame');
    const fullscreenDemoBtn = document.getElementById('fullscreen-demo');
    
    // iframe加载状态管理
    if (demoFrame) {
        demoFrame.addEventListener('load', function() {
            console.log('在线演示加载完成');
            // 隐藏覆盖层（如果还在显示）
            if (iframeOverlay && iframeOverlay.style.display !== 'none') {
                // 可以在这里添加加载完成的指示
            }
        });
        
        demoFrame.addEventListener('error', function() {
            console.error('在线演示加载失败');
            if (iframeOverlay) {
                overlayContent = iframeOverlay.querySelector('.overlay-content');
                if (overlayContent) {
                    overlayContent.innerHTML = `
                        <h3>加载失败</h3>
                        <p>无法加载在线演示，请直接访问</p>
                        <a href="https://arsvt3d.netlify.app/" target="_blank" class="btn primary" rel="noopener noreferrer">
                            在新窗口打开
                        </a>
                    `;
                }
            }
        });
    }
    
    if (startDemoBtn && iframeOverlay && demoFrame) {
        startDemoBtn.addEventListener('click', function() {
            // 显示加载指示
            const overlayContent = iframeOverlay.querySelector('.overlay-content');
            if (overlayContent) {
                overlayContent.innerHTML = `
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <h3>正在加载游戏...</h3>
                        <p>请稍候，游戏正在准备中</p>
                    </div>
                `;
            }
            
            // 延迟隐藏覆盖层，给用户足够的反馈
            setTimeout(() => {
                iframeOverlay.style.display = 'none';
                // 确保iframe获得焦点
                setTimeout(() => {
                    demoFrame.focus();
                }, 100);
            }, 1500);
            
            // 记录开始游戏事件
            console.log('用户开始在线演示');
        });
    }
    
    // 全屏预览功能
    if (fullscreenDemoBtn && demoFrame) {
        fullscreenDemoBtn.addEventListener('click', function() {
            // 检查是否支持全屏API
            if (demoFrame.requestFullscreen || demoFrame.webkitRequestFullscreen || 
                demoFrame.mozRequestFullScreen || demoFrame.msRequestFullscreen) {
                
                // 先在新窗口打开
                const newWindow = window.open('https://arsvt3d.netlify.app/', '_blank');
                if (newWindow) {
                    newWindow.focus();
                } else {
                    // 如果无法打开新窗口，尝试当前页面全屏
                    try {
                        if (demoFrame.requestFullscreen) {
                            demoFrame.requestFullscreen();
                        } else if (demoFrame.webkitRequestFullscreen) {
                            demoFrame.webkitRequestFullscreen();
                        } else if (demoFrame.mozRequestFullScreen) {
                            demoFrame.mozRequestFullScreen();
                        } else if (demoFrame.msRequestFullscreen) {
                            demoFrame.msRequestFullscreen();
                        }
                        
                        // 添加全屏样式
                        demoFrame.classList.add('fullscreen');
                        
                        // 添加全屏控制按钮
                        addFullscreenControls();
                    } catch (error) {
                        // 如果全屏失败，回到新窗口方案
                        window.open('https://arsvt3d.netlify.app/', '_blank');
                    }
                }
            } else {
                // 如果不支持全屏API，直接在新窗口打开
                window.open('https://arsvt3d.netlify.app/', '_blank');
            }
        });
    }
    
    // 添加全屏控制按钮的函数
    function addFullscreenControls() {
        // 检查是否已经添加了控制按钮
        if (document.querySelector('.fullscreen-controls')) {
            return;
        }
        
        const controls = document.createElement('div');
        controls.className = 'fullscreen-controls';
        controls.innerHTML = `
            <button class="fullscreen-btn" id="exit-fullscreen" title="退出全屏">✕</button>
            <button class="fullscreen-btn" id="new-window" title="在新窗口打开">↗</button>
        `;
        
        document.body.appendChild(controls);
        
        // 添加事件监听器
        document.getElementById('exit-fullscreen').addEventListener('click', function() {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        });
        
        document.getElementById('new-window').addEventListener('click', function() {
            window.open('https://arsvt3d.netlify.app/', '_blank');
        });
    }
    
    // 监听全屏状态变化
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    function handleFullscreenChange() {
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || 
                               document.mozFullScreenElement || document.msFullscreenElement);
        
        if (!isFullscreen && demoFrame) {
            demoFrame.classList.remove('fullscreen');
            // 移除全屏控制按钮
            const controls = document.querySelector('.fullscreen-controls');
            if (controls) {
                controls.remove();
            }
        }
    }
    
    // 键盘快捷键支持
    document.addEventListener('keydown', function(e) {
        // F键切换全屏
        if (e.key === 'f' || e.key === 'F') {
            // 确保焦点不在输入框中
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                fullscreenDemoBtn.click();
                e.preventDefault();
            }
        }
    });
});