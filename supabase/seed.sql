-- Local development seed data only. Everything here is fictional.
-- Never run against production.

-- ---------------------------------------------------------------- 20 demo companies
-- Every name starts with "Demo" so nobody mistakes them for real businesses.

insert into public.companies (name, slug, industry, state, city, website, size_range, description, status) values
  ('Demo Harbour Bank', 'demo-harbour-bank', 'Banking & Finance', 'Lagos', 'Victoria Island', 'https://example.com/harbour', '1000+', 'Fictional retail bank used for local development.', 'active'),
  ('Demo Savannah Telecoms', 'demo-savannah-telecoms', 'Telecoms', 'Lagos', 'Ikoyi', 'https://example.com/savannah', '1000+', 'Fictional mobile network for local development.', 'active'),
  ('Demo Palmwine Foods', 'demo-palmwine-foods', 'FMCG & Manufacturing', 'Ogun', 'Ota', null, '501-1000', 'Fictional food manufacturer for local development.', 'active'),
  ('Demo Kola Pay', 'demo-kola-pay', 'Fintech', 'Lagos', 'Yaba', 'https://example.com/kolapay', '201-500', 'Fictional payments startup for local development.', 'active'),
  ('Demo Niger Delta Energy', 'demo-niger-delta-energy', 'Oil & Gas', 'Rivers', 'Port Harcourt', null, '1000+', 'Fictional energy company for local development.', 'active'),
  ('Demo Okapi Logistics', 'demo-okapi-logistics', 'Logistics & Transport', 'Kano', 'Kano', null, '201-500', 'Fictional haulage company for local development.', 'active'),
  ('Demo Baobab Hospital', 'demo-baobab-hospital', 'Healthcare & Pharma', 'FCT', 'Garki', null, '201-500', 'Fictional hospital for local development.', 'active'),
  ('Demo Iroko Academy', 'demo-iroko-academy', 'Education', 'Oyo', 'Ibadan', null, '51-200', 'Fictional private school for local development.', 'active'),
  ('Demo Lagoon Realty', 'demo-lagoon-realty', 'Real Estate & Construction', 'Lagos', 'Lekki', null, '51-200', 'Fictional property developer for local development.', 'active'),
  ('Demo Sunbird Media', 'demo-sunbird-media', 'Media & Entertainment', 'Lagos', 'Surulere', null, '11-50', 'Fictional media house for local development.', 'active'),
  ('Demo Weaver Software', 'demo-weaver-software', 'Technology & Software', 'Enugu', 'Enugu', 'https://example.com/weaver', '11-50', 'Fictional software studio for local development.', 'active'),
  ('Demo Plateau Farms', 'demo-plateau-farms', 'Agriculture', 'Plateau', 'Jos', null, '51-200', 'Fictional farm business for local development.', 'active'),
  ('Demo Comet Insurance', 'demo-comet-insurance', 'Insurance', 'Lagos', 'Ikeja', null, '201-500', 'Fictional insurer for local development.', 'active'),
  ('Demo Gazelle Stores', 'demo-gazelle-stores', 'Retail & E-commerce', 'Kaduna', 'Kaduna', null, '501-1000', 'Fictional supermarket chain for local development.', 'active'),
  ('Demo Heron Consulting', 'demo-heron-consulting', 'Consulting & Professional Services', 'FCT', 'Maitama', null, '11-50', 'Fictional consultancy for local development.', 'active'),
  ('Demo Lily Hotels', 'demo-lily-hotels', 'Hospitality & Food', 'Cross River', 'Calabar', null, '51-200', 'Fictional hotel group for local development.', 'active'),
  ('Demo Willow Power', 'demo-willow-power', 'Energy & Power', 'Edo', 'Benin City', null, '201-500', 'Fictional power distributor for local development.', 'active'),
  ('Demo Meadow Foundation', 'demo-meadow-foundation', 'NGO & Non-profit', 'Borno', 'Maiduguri', null, '11-50', 'Fictional charity for local development.', 'active'),
  ('Demo Valley Agency', 'demo-valley-agency', 'Government & Public Sector', 'FCT', 'Central Area', null, '1000+', 'Fictional public agency for local development.', 'active'),
  ('Demo River Microfinance', 'demo-river-microfinance', 'Banking & Finance', 'Anambra', 'Onitsha', null, '11-50', 'Fictional microfinance bank for local development.', 'active');

-- ---------------------------------------------------------------- demo reviewers
-- Fictional users that can't log in (no password), only so seeded reviews have authors.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', ('00000000-0000-4000-8000-00000000000' || n)::uuid,
       'authenticated', 'authenticated', 'demo-reviewer-' || n || '@example.test', '', now(),
       now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''
  from generate_series(1, 5) n;

insert into public.profiles (id, pseudonym, user_type, onboarded_at)
select ('00000000-0000-4000-8000-00000000000' || n)::uuid, 'DemoReviewer' || (10 + n), 'former_employee', now()
  from generate_series(1, 5) n;

-- ---------------------------------------------------------------- demo reviews
-- Demo Harbour Bank: 5 visible reviews (ratings show). Demo Kola Pay: 2 (not enough yet).

insert into public.reviews (company_id, author_id, employment_status, department, employment_type, state,
  rating_overall, rating_pay, rating_work_life, rating_management, rating_culture, rating_growth,
  salary_on_time, overtime_paid, has_hmo, pension_remitted, got_contract, probation_months, confirmed_after_probation,
  headline, pros, cons, advice_to_management, publish_at)
select c.id, ('00000000-0000-4000-8000-00000000000' || v.n)::uuid, v.es::public.employment_status,
       v.dept::public.department, v.et::public.employment_type, 'Lagos',
       v.o, v.p, v.wl, v.m, v.cu, v.g,
       v.sot::public.yes_no_sometimes, v.otp::public.yes_no_sometimes, v.hmo::public.yes_no_sometimes,
       v.pen::public.yes_no_sometimes, v.con::public.yes_no_sometimes, v.prob, v.conf::public.probation_outcome,
       v.headline, v.pros, v.cons, v.advice, now() - (v.n * 20 || ' days')::interval
  from public.companies c
  join (values
    (1, 'current', 'sales_marketing', 'full_time', 4, 4, 2, 3, 4, 4, 'yes', 'no', 'yes', 'yes', 'yes', 6, 'yes',
     '(Demo) Good training, long hours', '(Demo review) Structured training programme and salary always comes on the 25th.', '(Demo review) Targets are heavy and you often stay past 7pm without overtime pay.', '(Demo) Review the sales targets every quarter.'),
    (2, 'former', 'operations_logistics', 'contract', 3, 2, 3, 3, 3, 2, 'yes', 'no', 'no', 'sometimes', 'no', null, null,
     '(Demo) Contract staff are treated differently', '(Demo review) Colleagues are friendly and the branch was well organised.', '(Demo review) Contract staff get no HMO and no clear path to permanent roles.', null),
    (3, 'current', 'tech_it', 'full_time', 5, 4, 4, 4, 5, 5, 'yes', 'sometimes', 'yes', 'yes', 'yes', 3, 'yes',
     '(Demo) Great team to learn from', '(Demo review) Modern tools, good mentors and real ownership of projects.', '(Demo review) Approvals for new tools can take a long time.', null),
    (4, 'former', 'customer_service', 'nysc', 3, 2, 3, 2, 3, 3, 'no', 'no', 'no', 'no', 'no', null, null,
     '(Demo) Okay for service year', '(Demo review) You learn how a bank works and meet many people.', '(Demo review) Corps members do full-time work for a small allowance.', '(Demo) Pay corps members a fair stipend.'),
    (5, 'former', 'finance_accounts', 'full_time', 4, 4, 3, 4, 4, 3, 'yes', 'no', 'yes', 'yes', 'yes', 6, 'yes',
     '(Demo) Stable and pays on time', '(Demo review) Salary and pension are always on time, and HMO covers family.', '(Demo review) Promotions are slow and depend on who you know.', null)
  ) as v(n, es, dept, et, o, p, wl, m, cu, g, sot, otp, hmo, pen, con, prob, conf, headline, pros, cons, advice)
    on true
 where c.slug = 'demo-harbour-bank';

insert into public.reviews (company_id, author_id, employment_status, employment_type,
  rating_overall, rating_pay, rating_work_life, rating_management, rating_culture, rating_growth,
  salary_on_time, headline, pros, cons, publish_at)
select c.id, ('00000000-0000-4000-8000-00000000000' || n)::uuid, 'current', 'full_time',
       4, 4, 3, 4, 4, 5, 'yes', '(Demo) Fast-paced startup',
       '(Demo review) You learn quickly and the team is very supportive.',
       '(Demo review) Priorities change often and weekends sometimes disappear.',
       now() - (n * 30 || ' days')::interval
  from public.companies c, generate_series(1, 2) n
 where c.slug = 'demo-kola-pay';
