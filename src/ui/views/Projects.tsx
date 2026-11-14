import type { Project } from '../../core/types';
import { countLabel, fmtDate } from '../../core/utils';
import { archive, query, selectedProject } from '../state';
import { BackButton, Badge, Collapsible, EmptyState, Icon, Markdown, SearchInput } from '../components';
import { exportProjectZip } from '../actions';

function ProjectDetail({ project }: { project: Project }) {
  return (
    <div class="view detail-view">
      <div class="detail-heading">
        <BackButton onClick={() => { selectedProject.value = null; }} label="К проектам" />
        <div class="detail-actions">
          <button type="button" class="button button-small" onClick={() => exportProjectZip(project)}>
            <Icon name="download" size={14} /> ZIP
          </button>
        </div>
      </div>
      <header class="detail-header">
        <div>
          <h1>{project.name}</h1>
          <div class="chat-meta">
            <span>{fmtDate(project.created_at, true)}</span>
            <span>·</span>
            <span>{countLabel(project.docs.length, ['документ', 'документа', 'документов'])}</span>
            {project.is_private ? <Badge tone="muted">приватный</Badge> : null}
            {project.is_starter_project ? <Badge tone="accent">стартовый</Badge> : null}
          </div>
        </div>
      </header>

      <section class="panel">
        <div class="panel-heading"><h2>Описание</h2></div>
        {project.description ? <Markdown text={project.description} /> : <p class="muted">Описание не указано.</p>}
      </section>

      {project.prompt_template ? (
        <section class="panel">
          <div class="panel-heading"><h2>Инструкции проекта</h2></div>
          <Markdown text={project.prompt_template} />
        </section>
      ) : null}

      <section class="panel">
        <div class="panel-heading">
          <h2>Документы</h2>
          <Badge tone="muted">{project.docs.length}</Badge>
        </div>
        {project.docs.length === 0 ? (
          <p class="muted">Документов нет.</p>
        ) : (
          <div class="doc-list">
            {project.docs.map((doc) => (
              <Collapsible
                key={doc.uuid || doc.filename}
                summary={<><Icon name="file" size={15} /> {doc.filename} <span class="muted small">{doc.content.length.toLocaleString('ru-RU')} символов</span></>}
              >
                <Markdown text={doc.content} />
              </Collapsible>
            ))}
          </div>
        )}
      </section>

      <p class="muted small">
        В этой версии экспорта Claude не сохраняет связь «проект → чаты», поэтому список чатов проекта недоступен.
      </p>
    </div>
  );
}

export function ProjectsView() {
  const a = archive.value;
  if (!a) return null;

  if (selectedProject.value) {
    const project = a.projects.find((item) => item.uuid === selectedProject.value);
    if (project) return <ProjectDetail project={project} />;
  }

  const q = query.value.trim().toLowerCase();
  const projects = q
    ? a.projects.filter((project) =>
        `${project.name} ${project.description} ${project.docs.map((doc) => doc.filename).join(' ')}`
          .toLowerCase()
          .includes(q),
      )
    : a.projects;

  return (
    <div class="view">
      <div class="view-heading">
        <div>
          <h1>Проекты</h1>
          <p class="muted">{countLabel(a.projects.length, ['проект', 'проекта', 'проектов'])}</p>
        </div>
      </div>
      <div class="toolbar">
        <SearchInput value={query.value} onInput={(value) => { query.value = value; }} placeholder="Поиск по проектам и документам…" />
      </div>
      {projects.length === 0 ? (
        <EmptyState title="Проекты не найдены" text="Загрузите projects-000.zip." icon="project" />
      ) : (
        <div class="project-grid">
          {projects.map((project) => (
            <button type="button" class="project-card" key={project.uuid} onClick={() => { selectedProject.value = project.uuid; }}>
              <div class="project-card-top">
                <span class="project-icon"><Icon name="project" size={20} /></span>
                <span class="muted small">{fmtDate(project.updated_at || project.created_at)}</span>
              </div>
              <h3>{project.name}</h3>
              <p class="muted small">{project.description || 'Без описания'}</p>
              <div class="project-card-bottom">
                <Badge tone="muted">{countLabel(project.docs.length, ['документ', 'документа', 'документов'])}</Badge>
                {project.prompt_template ? <Badge tone="accent">инструкции</Badge> : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
