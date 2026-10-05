# v0.44.0 — WEB workspace

Статус: WEB и исправление Contacts приняты владельцем 2026-10-05.
Сборка и guarded deploy на VDS подтверждены выводом терминала.
Публикация релиза определяется remote main и аннотированным тегом v0.44.0.
Основа: v0.43.0, 62520c69e2041ca669a6430c9487a81e3c4976ce.

## Интерфейс

- На desktop шире 760 px хедер занимает одну строку, без названия проекта
  и без поиска. Network, Activity, View и More открывают dropdowns.
- Быстрые действия: фильтры, события, видимость панели, новый контакт, темы.
- На узком экране разрешены две строки; события доступны через Activity.
- Один граф остаётся смонтированным при смене раздела или темы. Менеджеры,
  поиск, фильтры и сведения о выбранном контакте открываются справа.
- На телефоне панель находится поверх нижней части графа и закрывается
  отдельной кнопкой; её содержимое прокручивается независимо.
- Существующий редактор фото/иконки из графа сохраняет свой modal dialog.
- Продуктовые надписи остаются на английском.

## Изменения и сохранение

- Light: #F7ECF5 → #F5E3E3 → #ECDCE4; Dark: #1C1B20.
- Цвета основных и второстепенных подписей, выбранных/неактивных узлов,
  акценты центрального узла и размер подписей меняются сразу.
- Эти настройки интерфейса хранятся отдельно для двух тем в localStorage.
  Сброс затрагивает только текущую тему. Недоступное или повреждённое
  хранилище не блокирует приложение.
- Circles & connections показывает изменения на графе до Save.
  Сохранённые настройки линий остаются общими серверными настройками,
  как и раньше; отдельные серверные наборы для тем не создаются.
- При редактировании контакта имя, важность и круг показываются на графе
  до Save. Черновик существует только в памяти вкладки. Его узел не
  вызывает запросов media и не увеличивает сохранённое число контактов.
- Переход в другой раздел с несохранёнными правками требует подтверждения.
  Закрытие правой панели сохраняет открытый редактор и его черновик.
- Контакты, фото, env и приватные backup не добавляются в исходники.
  Авторизация, API, схема БД, Compose и backup automation не изменены.

## Проверено только для новой реализации

- TypeScript: tsc --noEmit.
- Production WEB build: npm run build.
- Chromium, полностью синтетические API-ответы и шесть вымышленных контактов:
  ширины 1440, 1024, 800, 761, 390 и 320 px; отсутствие переполнения хедера;
  реальное рисование цвета и размера подписей; переключение и сохранение
  тем; предпросмотр линий; черновик без API-записи и browser storage;
  отказ/подтверждение перехода; закрытие и открытие панели; повторная загрузка
  и повреждённые настройки. Исключений JavaScript не обнаружено.
- Vite сообщает о размере JS chunk немного больше 500 kB. Разбиение пакета
  не включено в текущую задачу. VDS build с TypeScript-проверкой и guarded deploy подтверждены ниже.

Повторяемый локальный сценарий: scripts/ui/test-workspace.cjs.
Требуется Playwright вне production dependencies. Можно указать
PNET_PLAYWRIGHT (путь к модулю), PNET_CHROMIUM (путь к браузеру) и
PNET_TEST_DIST=apps/web/dist. В этом режиме все файлы и API-ответы
перехватываются тестом; обращения к VDS нет.

## Сборка и выпуск — процедура, выполненная для этой версии

Собрать новый WEB image под отдельным candidate tag из Git index,
включающего только согласованный патч. Не копировать весь рабочий каталог
в Docker context: там могут быть локальные, неотслеживаемые файлы.
Dockerfile теперь выполняет TypeScript-проверку перед WEB build.
Не пересобирать API и не перезаписывать текущий WEB image/tag.
После успешной сборки использовать существующий guarded deploy.py с
точными локальными image IDs API и нового WEB. Этот deploy пересоздаёт
API с прежним образом, затем WEB, и может кратковременно прервать доступ;
DB и приватные mounts сохраняются, checkpoint обеспечивает rollback.
При ошибке сборки работающая версия продолжает работать.
После deploy требуется визуальная приёмка владельцем перед Git-релизом.

## Contacts layout correction — 2026-10-05

Owner reports the deployed workspace works, with horizontal overflow in Contacts.
The contact table is replaced by a semantic list of cards. All six original
contact actions appear immediately below the name; company, position, location
and importance follow as wrapping labelled values. Existing action handlers
and API behaviour are preserved. Desktop inspector width grows from 360 to
400 px (330 to 370 px at intermediate widths); the mobile viewport limit remains.
Targeted Chromium checks passed in both themes at 1440/800/390/320 px,
including long unbroken names and company values, absence of horizontal pane
scroll, action placement, six buttons and Edit. TypeScript and WEB build passed.
Test: scripts/ui/test-contact-cards.cjs, using the same local synthetic API setup.
Owner accepted the deployed correction on 2026-10-05: everything works.

## Подтверждённая приёмка — 2026-10-05

- Локальные проверки новой реализации и Contacts перечислены выше.
- Вывод VDS подтверждает успешную сборку pnet-web:v0.44.0-contacts-fix
  с tsc --noEmit и npm run build.
- Финальный WEB image:
  sha256:594d2625a10dba5d21ebe72de35fa537fcd018e8e52630ecf6d3d24441514de9.
- Сохранён прежний API image:
  sha256:f5d91562689bf2d22685326d2c36021797c3fe84f7c49703010a1ccf4e3835ec.
- Guarded deploy сообщил DEPLOY_OK: API_WEB_HEALTHY_DB_UNCHANGED;
  API и WEB running/healthy. Повторный deploy для Git-релиза не требуется.
- Владелец подтвердил работу WEB и исправления Contacts.
- Новый отчёт monitor в рамках этой приёмки не запрашивался.
- Контакты, фото, секреты и backups остаются на VDS вне Git.
