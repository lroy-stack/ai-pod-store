-- Seed data for design_templates_library (6 starter templates)
INSERT INTO design_templates_library (name, name_es, name_de, category, tags, thumbnail_url, fabric_json, product_types, is_active, use_count)
VALUES
(
  'Bold Statement',
  'Declaracion Audaz',
  'Starke Aussage',
  'minimalist',
  '{bold,text,statement,minimal}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''200'' height=''200''%3E%3Crect width=''200'' height=''200'' fill=''%23f5f5f5''/%3E%3Ctext x=''100'' y=''105'' text-anchor=''middle'' font-size=''24'' font-weight=''bold'' fill=''%23333''%3EBOLD%3C/text%3E%3C/svg%3E',
  '{"version":"6.0.0","objects":[{"type":"Textbox","text":"YOUR TEXT HERE","left":150,"top":200,"fontSize":56,"fontFamily":"Arial","fill":"#FFFFFF","textAlign":"center","width":300,"fontWeight":"bold"}]}',
  '{t-shirts,hoodies,sweatshirts}',
  true,
  0
),
(
  'Clean Minimal',
  'Minimalismo Limpio',
  'Sauberer Minimalismus',
  'minimalist',
  '{clean,elegant,minimal,line}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''200'' height=''200''%3E%3Crect width=''200'' height=''200'' fill=''%23f5f5f5''/%3E%3Cline x1=''60'' y1=''95'' x2=''140'' y2=''95'' stroke=''%23999'' stroke-width=''1''/%3E%3Ctext x=''100'' y=''120'' text-anchor=''middle'' font-size=''14'' fill=''%23555''%3Eminimal%3C/text%3E%3Cline x1=''60'' y1=''130'' x2=''140'' y2=''130'' stroke=''%23999'' stroke-width=''1''/%3E%3C/svg%3E',
  '{"version":"6.0.0","objects":[{"type":"Textbox","text":"your text","left":150,"top":220,"fontSize":24,"fontFamily":"Georgia","fill":"#CCCCCC","textAlign":"center","width":300},{"type":"Line","x1":0,"y1":0,"x2":200,"y2":0,"left":100,"top":195,"stroke":"#CCCCCC","strokeWidth":1}]}',
  '{t-shirts,hoodies,sweatshirts}',
  true,
  0
),
(
  'Retro Type',
  'Tipo Retro',
  'Retro Schrift',
  'typography',
  '{retro,outline,vintage,type}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''200'' height=''200''%3E%3Crect width=''200'' height=''200'' fill=''%23f5f5f5''/%3E%3Ctext x=''100'' y=''110'' text-anchor=''middle'' font-size=''28'' font-weight=''bold'' fill=''none'' stroke=''%23333'' stroke-width=''1.5''%3ERETRO%3C/text%3E%3C/svg%3E',
  '{"version":"6.0.0","objects":[{"type":"Textbox","text":"RETRO","left":150,"top":200,"fontSize":64,"fontFamily":"Impact","fill":"transparent","textAlign":"center","width":300,"stroke":"#FFFFFF","strokeWidth":2}]}',
  '{t-shirts,hoodies,sweatshirts}',
  true,
  0
),
(
  'Stack Text',
  'Texto Apilado',
  'Gestapelter Text',
  'typography',
  '{stack,two-line,hierarchy,type}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''200'' height=''200''%3E%3Crect width=''200'' height=''200'' fill=''%23f5f5f5''/%3E%3Ctext x=''100'' y=''90'' text-anchor=''middle'' font-size=''14'' fill=''%23999''%3ESMALL TOP%3C/text%3E%3Ctext x=''100'' y=''120'' text-anchor=''middle'' font-size=''28'' font-weight=''bold'' fill=''%23333''%3EBIG TEXT%3C/text%3E%3C/svg%3E',
  '{"version":"6.0.0","objects":[{"type":"Textbox","text":"SMALL TOP","left":150,"top":170,"fontSize":20,"fontFamily":"Arial","fill":"#AAAAAA","textAlign":"center","width":300},{"type":"Textbox","text":"BIG TEXT","left":150,"top":210,"fontSize":56,"fontFamily":"Arial","fill":"#FFFFFF","textAlign":"center","width":300,"fontWeight":"bold"}]}',
  '{t-shirts,hoodies,sweatshirts}',
  true,
  0
),
(
  'Geo Circle',
  'Circulo Geometrico',
  'Geometrischer Kreis',
  'geometric',
  '{circle,geometric,badge,round}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''200'' height=''200''%3E%3Crect width=''200'' height=''200'' fill=''%23f5f5f5''/%3E%3Ccircle cx=''100'' cy=''100'' r=''60'' fill=''none'' stroke=''%23333'' stroke-width=''2''/%3E%3Ctext x=''100'' y=''105'' text-anchor=''middle'' font-size=''14'' fill=''%23333''%3ETEXT%3C/text%3E%3C/svg%3E',
  '{"version":"6.0.0","objects":[{"type":"Circle","left":150,"top":150,"radius":100,"fill":"transparent","stroke":"#FFFFFF","strokeWidth":3,"originX":"center","originY":"center"},{"type":"Textbox","text":"TEXT","left":150,"top":150,"fontSize":32,"fontFamily":"Arial","fill":"#FFFFFF","textAlign":"center","width":150,"originX":"center","originY":"center"}]}',
  '{t-shirts,hoodies,sweatshirts}',
  true,
  0
),
(
  'Diamond Frame',
  'Marco Diamante',
  'Diamant Rahmen',
  'geometric',
  '{diamond,frame,geometric,shape}',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''200'' height=''200''%3E%3Crect width=''200'' height=''200'' fill=''%23f5f5f5''/%3E%3Cpolygon points=''100,30 170,100 100,170 30,100'' fill=''none'' stroke=''%23333'' stroke-width=''2''/%3E%3Ctext x=''100'' y=''105'' text-anchor=''middle'' font-size=''14'' fill=''%23333''%3ETEXT%3C/text%3E%3C/svg%3E',
  '{"version":"6.0.0","objects":[{"type":"Polygon","points":[{"x":0,"y":-100},{"x":100,"y":0},{"x":0,"y":100},{"x":-100,"y":0}],"left":150,"top":200,"fill":"transparent","stroke":"#FFFFFF","strokeWidth":3,"originX":"center","originY":"center"},{"type":"Textbox","text":"TEXT","left":150,"top":200,"fontSize":28,"fontFamily":"Arial","fill":"#FFFFFF","textAlign":"center","width":120,"originX":"center","originY":"center"}]}',
  '{t-shirts,hoodies,sweatshirts}',
  true,
  0
)
ON CONFLICT DO NOTHING;
