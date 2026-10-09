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

-- ---------------------------------------------------------------- demo salary reports
-- Demo Harbour Bank: Tech & IT / Mid has 3 reports (shown); Sales & Marketing / Entry has 2 (hidden).

insert into public.salary_reports (company_id, author_id, role_group, level, employment_type, state,
  monthly_gross_naira, has_bonus, other_benefits, publish_at)
select c.id, ('00000000-0000-4000-8000-00000000000' || v.n)::uuid, v.rg::public.department, v.lvl::public.salary_level,
       'full_time', 'Lagos', v.pay, v.bonus, v.benefits, now() - (v.n * 15 || ' days')::interval
  from public.companies c
  join (values
    (1, 'tech_it', 'mid', 450000, true, array['hmo', 'thirteenth_month']),
    (2, 'tech_it', 'mid', 520000, true, array['hmo', 'transport']),
    (3, 'tech_it', 'mid', 610000, false, array['hmo']),
    (4, 'sales_marketing', 'entry', 180000, false, array[]::text[]),
    (5, 'sales_marketing', 'entry', 210000, true, array['transport', 'feeding'])
  ) as v(n, rg, lvl, pay, bonus, benefits) on true
 where c.slug = 'demo-harbour-bank';

-- ---------------------------------------------------------------- demo interview reports

insert into public.interview_reports (company_id, author_id, role_group, outcome, difficulty, process_weeks,
  stages, questions_asked, tips, experience, publish_at)
select c.id, ('00000000-0000-4000-8000-00000000000' || v.n)::uuid, v.rg::public.department,
       v.outcome::public.interview_outcome, v.diff, v.weeks, v.stages, v.questions, v.tips,
       v.exp::public.interview_experience, now() - (v.n * 10 || ' days')::interval
  from public.companies c
  join (values
    (1, 'tech_it', 'offer', 3, 4, array['aptitude_test', 'phone_call', 'final_interview'],
     '(Demo) Explain a project you built. How would you design a simple payments queue?', '(Demo) Practise aptitude tests with a timer.', 'positive'),
    (2, 'customer_service', 'ghosted', 2, 6, array['aptitude_test', 'panel'],
     '(Demo) How would you calm an angry customer whose transfer failed?', null, 'negative'),
    (3, 'sales_marketing', 'no_offer', 3, 3, array['phone_call', 'panel'],
     '(Demo) Sell this pen to me. What target did you beat at your last job?', '(Demo) Bring numbers from your last role.', 'neutral'),
    (4, 'finance_accounts', 'offer', 4, 8, array['aptitude_test', 'assessment', 'panel', 'final_interview'],
     '(Demo) Walk us through a bank reconciliation. Case study on loan provisioning.', null, 'positive')
  ) as v(n, rg, outcome, diff, weeks, stages, questions, tips, exp) on true
 where c.slug = 'demo-harbour-bank';

-- ---------------------------------------------------------------- demo posts, replies, likes
-- 14 posts (more than one page of 10), spread over the last few days.

insert into public.posts (id, author_id, company_id, category, body, created_at)
select ('10000000-0000-4000-8000-0000000000' || lpad(v.n::text, 2, '0'))::uuid,
       ('00000000-0000-4000-8000-00000000000' || (1 + v.n % 5))::uuid,
       (select id from public.companies where slug = v.company),
       v.category::public.post_category, v.body,
       now() - (v.n * 5 || ' hours')::interval
  from (values
    (1, 'demo-harbour-bank', 'salary_benefits', '(Demo post) Does anyone know if Demo Harbour Bank pays the 13th month in December or January?'),
    (2, null, 'career_advice', '(Demo post) Moving from customer service into product. Which short courses actually helped you?'),
    (3, null, 'work_life_balance', '(Demo post) How do you handle bosses who send messages at 11pm and expect a reply?'),
    (4, 'demo-kola-pay', 'workplace_culture', '(Demo post) Startup culture in Yaba: free lunch is nice, but is it worth the weekend work?'),
    (5, null, 'job_offers', '(Demo post) Got two offers: one pays more, the other has HMO and pension. Which would you pick?'),
    (6, null, 'interview_experiences', '(Demo post) Tip: practise aptitude tests with a timer. The real ones are much faster than you expect.'),
    (7, null, 'management', '(Demo post) What makes a good first-time manager? Mine is trying hard but struggles to say no.'),
    (8, 'demo-weaver-software', 'general', '(Demo post) Anyone else working remotely from Enugu? Light has been better this month.'),
    (9, null, 'salary_benefits', '(Demo post) Is ₦250,000 a fair starting salary for a junior accountant in Lagos in 2026?'),
    (10, null, 'career_advice', '(Demo post) Should I do my MSc now or get two more years of experience first?'),
    (11, null, 'workplace_culture', '(Demo post) Our office started Friday casual dress and honestly morale went up.'),
    (12, null, 'general', '(Demo post) What do you wish you had asked before accepting your first job offer?'),
    (13, null, 'job_offers', '(Demo post) The offer letter says "salary is confidential". Is that normal?'),
    (14, null, 'interview_experiences', '(Demo post) Waited three hours at reception for a 15-minute interview. Is that normal now?')
  ) as v(n, company, category, body);

insert into public.replies (post_id, author_id, body, created_at)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', '(Demo reply) It came with the December salary when I was there.', now() - interval '4 hours'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', '(Demo reply) Same here, but only for confirmed staff.', now() - interval '3 hours'),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', '(Demo reply) HMO and pension add up. I would pick that one.', now() - interval '20 hours');

-- Notifications for those replies were created by the trigger; mark them read.
update public.notifications set is_read = true;

insert into public.post_likes (post_id, user_id)
select ('10000000-0000-4000-8000-0000000000' || lpad(p::text, 2, '0'))::uuid, ('00000000-0000-4000-8000-00000000000' || u)::uuid
  from (values (1, 2), (1, 3), (1, 4), (5, 1), (5, 2), (9, 3)) as l(p, u);
