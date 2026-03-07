-- Seed data for design_clipart (10 starter cliparts)
INSERT INTO design_clipart (name, name_es, name_de, category, tags, svg_url, thumbnail_url, is_active, use_count)
VALUES
(
  'Star',
  'Estrella',
  'Stern',
  'icons',
  '{star,icon,favorite}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpolygon points=''50,5 63,38 98,38 70,60 80,95 50,73 20,95 30,60 2,38 37,38'' fill=''%23333''/%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpolygon points=''50,5 63,38 98,38 70,60 80,95 50,73 20,95 30,60 2,38 37,38'' fill=''%23333''/%3E%3C/svg%3E',
  true,
  0
),
(
  'Heart',
  'Corazon',
  'Herz',
  'icons',
  '{heart,love,icon}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpath d=''M50 88 C25 65 5 50 5 30 C5 15 15 5 30 5 C40 5 48 12 50 18 C52 12 60 5 70 5 C85 5 95 15 95 30 C95 50 75 65 50 88Z'' fill=''%23333''/%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpath d=''M50 88 C25 65 5 50 5 30 C5 15 15 5 30 5 C40 5 48 12 50 18 C52 12 60 5 70 5 C85 5 95 15 95 30 C95 50 75 65 50 88Z'' fill=''%23333''/%3E%3C/svg%3E',
  true,
  0
),
(
  'Lightning',
  'Rayo',
  'Blitz',
  'icons',
  '{lightning,bolt,energy,icon}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpolygon points=''60,5 25,55 45,55 35,95 75,42 55,42'' fill=''%23333''/%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpolygon points=''60,5 25,55 45,55 35,95 75,42 55,42'' fill=''%23333''/%3E%3C/svg%3E',
  true,
  0
),
(
  'Crown',
  'Corona',
  'Krone',
  'icons',
  '{crown,royal,king,icon}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpolygon points=''10,70 10,35 30,50 50,20 70,50 90,35 90,70'' fill=''%23333''/%3E%3Crect x=''10'' y=''70'' width=''80'' height=''12'' fill=''%23333''/%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpolygon points=''10,70 10,35 30,50 50,20 70,50 90,35 90,70'' fill=''%23333''/%3E%3Crect x=''10'' y=''70'' width=''80'' height=''12'' fill=''%23333''/%3E%3C/svg%3E',
  true,
  0
),
(
  'Circle',
  'Circulo',
  'Kreis',
  'shapes',
  '{circle,shape,round}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Ccircle cx=''50'' cy=''50'' r=''45'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Ccircle cx=''50'' cy=''50'' r=''45'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3C/svg%3E',
  true,
  0
),
(
  'Square',
  'Cuadrado',
  'Quadrat',
  'shapes',
  '{square,shape,box}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Crect x=''10'' y=''10'' width=''80'' height=''80'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Crect x=''10'' y=''10'' width=''80'' height=''80'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3C/svg%3E',
  true,
  0
),
(
  'Triangle',
  'Triangulo',
  'Dreieck',
  'shapes',
  '{triangle,shape,geometric}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpolygon points=''50,10 90,90 10,90'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpolygon points=''50,10 90,90 10,90'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3C/svg%3E',
  true,
  0
),
(
  'Hexagon',
  'Hexagono',
  'Sechseck',
  'shapes',
  '{hexagon,shape,geometric}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpolygon points=''50,5 90,27 90,73 50,95 10,73 10,27'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpolygon points=''50,5 90,27 90,73 50,95 10,73 10,27'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3C/svg%3E',
  true,
  0
),
(
  'Simple Border',
  'Borde Simple',
  'Einfacher Rahmen',
  'borders',
  '{border,frame,rectangle}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Crect x=''5'' y=''5'' width=''90'' height=''90'' fill=''none'' stroke=''%23333'' stroke-width=''2''/%3E%3Crect x=''10'' y=''10'' width=''80'' height=''80'' fill=''none'' stroke=''%23333'' stroke-width=''1''/%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Crect x=''5'' y=''5'' width=''90'' height=''90'' fill=''none'' stroke=''%23333'' stroke-width=''2''/%3E%3Crect x=''10'' y=''10'' width=''80'' height=''80'' fill=''none'' stroke=''%23333'' stroke-width=''1''/%3E%3C/svg%3E',
  true,
  0
),
(
  'Corner Ornament',
  'Ornamento de Esquina',
  'Eckornament',
  'borders',
  '{corner,ornament,decorative,border}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpath d=''M5 30 L5 5 L30 5'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3Cpath d=''M5 15 L5 5 L15 5'' fill=''none'' stroke=''%23333'' stroke-width=''1.5''/%3E%3Cpath d=''M70 5 L95 5 L95 30'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3Cpath d=''M85 5 L95 5 L95 15'' fill=''none'' stroke=''%23333'' stroke-width=''1.5''/%3E%3Cpath d=''M95 70 L95 95 L70 95'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3Cpath d=''M95 85 L95 95 L85 95'' fill=''none'' stroke=''%23333'' stroke-width=''1.5''/%3E%3Cpath d=''M30 95 L5 95 L5 70'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3Cpath d=''M15 95 L5 95 L5 85'' fill=''none'' stroke=''%23333'' stroke-width=''1.5''/%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100'' viewBox=''0 0 100 100''%3E%3Cpath d=''M5 30 L5 5 L30 5'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3Cpath d=''M5 15 L5 5 L15 5'' fill=''none'' stroke=''%23333'' stroke-width=''1.5''/%3E%3Cpath d=''M70 5 L95 5 L95 30'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3Cpath d=''M85 5 L95 5 L95 15'' fill=''none'' stroke=''%23333'' stroke-width=''1.5''/%3E%3Cpath d=''M95 70 L95 95 L70 95'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3Cpath d=''M95 85 L95 95 L85 95'' fill=''none'' stroke=''%23333'' stroke-width=''1.5''/%3E%3Cpath d=''M30 95 L5 95 L5 70'' fill=''none'' stroke=''%23333'' stroke-width=''3''/%3E%3Cpath d=''M15 95 L5 95 L5 85'' fill=''none'' stroke=''%23333'' stroke-width=''1.5''/%3E%3C/svg%3E',
  true,
  0
)
ON CONFLICT DO NOTHING;
