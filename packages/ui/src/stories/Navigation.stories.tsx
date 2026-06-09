import '../styles.css';

import type { Meta, StoryObj } from '@storybook/react';

import {
  FilterToolbar,
  IconButton,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuShell,
  PanelMessage,
  PositionedMenu,
  SearchInput,
  SegmentedControl,
  SidebarNavButton,
  TabButton,
  TabList,
  TabPanel,
  TreeItemButton,
  WorkbenchTab,
  WorkbenchTabButton,
  WorkbenchTabCloseButton,
} from '../primitives';
import { StorySection, StoryStack, Wrap } from './storyUtils';

const meta = {
  title: 'Components/Navigation',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SidebarAndTree: Story = {
  render: () => (
    <StoryStack>
      <StorySection title="Sidebar Navigation">
        <div style={{ display: 'grid', gap: 2, width: 260, maxWidth: '100%' }}>
          <SidebarNavButton active>
            <span aria-hidden="true">[]</span>
            <span style={{ flex: 1 }}>Knowledge</span>
            <span className="ui-sidebar-nav-badge">3</span>
          </SidebarNavButton>
          <SidebarNavButton>
            <span aria-hidden="true">*</span>
            <span style={{ flex: 1 }}>Settings</span>
          </SidebarNavButton>
        </div>
      </StorySection>
      <StorySection title="Tree Items">
        <div role="tree" aria-label="Workspace tree" style={{ display: 'grid', gap: 2, width: 280, maxWidth: '100%' }}>
          <TreeItemButton selected expanded className="ui-sidebar-session-row ui-sidebar-session-row-active mx-0 w-full text-left">
            <span aria-hidden="true">v</span>
            <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Project</span>
          </TreeItemButton>
          <TreeItemButton className="ui-sidebar-session-row mx-0 w-full text-left">
            <span aria-hidden="true">-</span>
            <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Thread</span>
          </TreeItemButton>
        </div>
      </StorySection>
    </StoryStack>
  ),
};

export const MenusTabsAndWorkbench: Story = {
  render: () => (
    <StoryStack>
      <StorySection title="Menus">
        <Wrap>
          <MenuShell className="relative bottom-auto left-auto right-auto mb-0 w-56" aria-label="Story actions">
            <MenuGroupLabel>Show</MenuGroupLabel>
            <MenuItem checked>Enabled items</MenuItem>
            <MenuItem>All items</MenuItem>
            <MenuSeparator />
            <MenuItem tone="danger">Delete</MenuItem>
          </MenuShell>
          <PositionedMenu placement="static" className="w-56" aria-label="Positioned story actions">
            <MenuGroupLabel>Positioned</MenuGroupLabel>
            <MenuItem>Show log</MenuItem>
            <MenuItem tone="danger">Delete</MenuItem>
          </PositionedMenu>
        </Wrap>
      </StorySection>
      <StorySection title="Segments and Tabs">
        <SegmentedControl
          ariaLabel="Diff view"
          value="split"
          options={[
            { value: 'split', label: 'Split' },
            { value: 'unified', label: 'Unified' },
          ]}
          onChange={() => undefined}
        />
        <TabList ariaLabel="Extension filters">
          <TabButton active>All</TabButton>
          <TabButton>Enabled</TabButton>
          <TabButton>Attention</TabButton>
        </TabList>
        <TabList ariaLabel="Extension filters underline" variant="underline">
          <TabButton active>All</TabButton>
          <TabButton>Attention</TabButton>
        </TabList>
        <TabPanel style={{ borderTop: '1px solid rgb(var(--color-border-subtle))', paddingTop: 12 }}>
          <PanelMessage className="px-0 py-0">The active tab content renders inside a shared tab panel.</PanelMessage>
        </TabPanel>
        <FilterToolbar
          filters={
            <SegmentedControl
              ariaLabel="Status filter"
              value="all"
              options={[
                { value: 'all', label: 'All' },
                { value: 'enabled', label: 'Enabled' },
                { value: 'disabled', label: 'Disabled' },
              ]}
              onChange={() => undefined}
            />
          }
          search={<SearchInput placeholder="Search items..." />}
        />
      </StorySection>
      <StorySection title="Workbench Tabs">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            overflowX: 'auto',
            borderBottom: '1px solid rgb(var(--color-border-subtle))',
            background: 'rgb(var(--color-base))',
            padding: 8,
            width: 520,
            maxWidth: '100%',
          }}
        >
          <WorkbenchTab active title="Browser">
            <WorkbenchTabButton icon="[]" label="Browser" />
            <WorkbenchTabCloseButton aria-label="Close Browser" />
          </WorkbenchTab>
          <WorkbenchTab title="Draft">
            <WorkbenchTabButton icon="*" label="Draft notes" />
            <WorkbenchTabCloseButton aria-label="Close Draft notes" />
          </WorkbenchTab>
          <IconButton size="sm" className="h-8 w-8 rounded-md text-[16px]" aria-label="New tab">
            +
          </IconButton>
        </div>
      </StorySection>
    </StoryStack>
  ),
};
