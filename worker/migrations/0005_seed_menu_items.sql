-- Menu catalog seed (Option A): make D1 menu_items the single authoritative
-- food catalog so TALA's getMenu reads the SAME configured menu the Guest Portal
-- uses (cms_data.operations.menuItems defaults to these exact items). This
-- resolves the TALA (D1, empty) vs Portal (CMS) menu split with ONE backend
-- source. Prices are the configured Marina Terrace menu prices (authoritative).
-- Applied via `wrangler d1 migrations apply` (worker infra, not Supabase).

DELETE FROM menu_items WHERE tenant_id = 'marina_terrace';

INSERT INTO menu_items (id, tenant_id, name, description, category, price, food_cost, inventory_count, active, sort_order) VALUES
('mi_breakfast_1','marina_terrace','Corned Beef with Eggs','Corned beef served with two eggs and a choice of plain rice or toasted bread','breakfast',350,120,20,1,0),
('mi_breakfast_2','marina_terrace','French Toast','Custard-soaked bread, gently caramelized and served with maple syrup and whipped cream','breakfast',300,90,20,1,1),
('mi_breakfast_3','marina_terrace','Pancakes with Fruit or Chocolate Chips','Fluffy pancakes topped with fruit or chocolate chips, whipped cream, and maple syrup','breakfast',350,100,20,1,2),
('mi_breakfast_4','marina_terrace','Cheese Omelette','Fluffy omelette filled with Italian cheese and served with buttery toasted bread','breakfast',400,110,20,1,3),
('mi_breakfast_5','marina_terrace','Tropical Yogurt Bowl','Creamy yogurt topped with granola, honey, and seasonal island fruits','breakfast',320,85,20,1,4),
('mi_lunch_1','marina_terrace','Bruschetta','Toasted rustic bread topped with fresh tomatoes, basil, garlic, and olive oil','lunch',320,90,20,1,5),
('mi_lunch_2','marina_terrace','Papas Bravas','Crispy potatoes served with spicy brava sauce and garlic aioli','lunch',300,75,20,1,6),
('mi_lunch_3','marina_terrace','Linguine Aglio, Olio e Peperoncino','Linguine tossed with garlic, olive oil, chili, and Parmesan cheese','lunch',480,130,20,1,7),
('mi_lunch_4','marina_terrace','Tagliatelle Puttanesca','Ribbon pasta served with a tomato sauce containing olives, capers, garlic, and chili','lunch',550,150,20,1,8),
('mi_lunch_5','marina_terrace','Tonkatsu Pork Curry','Crispy breaded pork cutlet served with rich Japanese-style curry and rice','lunch',550,160,20,1,9),
('mi_dinner_1','marina_terrace','Shrimp Marinara Linguine','Linguine tossed in tomato marina sauce with sauteed shrimp','dinner',650,200,20,1,10),
('mi_dinner_2','marina_terrace','Shrimp a la Pobre','Garlic-sauteed shrimp served with rustic potatoes and caramelized onions','dinner',650,210,20,1,11),
('mi_dinner_3','marina_terrace','Mojo Verde Fish Fillet','Grilled fish fillet served with a fresh green herb sauce','dinner',650,190,20,1,12),
('mi_dinner_4','marina_terrace','Chicken Cacciatore','Chicken braised with tomatoes, herbs, bell peppers, and olives','dinner',600,170,20,1,13),
('mi_dinner_5','marina_terrace','Paccheri Carbonara','Large tube pasta served in a creamy sauce with egg, cheese, and cured meat','dinner',700,180,20,1,14),
('mi_drinks_1','marina_terrace','Bottled Water','500ml purified water','drinks',25,8,50,1,15),
('mi_drinks_2','marina_terrace','Coca-Cola / Sprite','330ml can','drinks',35,12,50,1,16),
('mi_drinks_3','marina_terrace','Fresh Buko Juice','Young coconut, natural sweetness','drinks',60,20,30,1,17),
('mi_drinks_4','marina_terrace','Iced Tea','House-brewed, lightly sweetened','drinks',50,10,40,1,18),
('mi_drinks_5','marina_terrace','San Miguel Beer','Pale Pilsen 330ml','drinks',70,25,50,1,19),
('mi_drinks_6','marina_terrace','Mango Shake','Fresh mango blended with ice','drinks',90,30,30,1,20);
