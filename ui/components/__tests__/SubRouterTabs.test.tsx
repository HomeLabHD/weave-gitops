import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { withTheme } from "../../lib/test-utils";
import SubRouterTabs, { RouterTab } from "../SubRouterTabs";

// Regression guard: MUI's <Tabs> requires its children to forward the props and ref it
// injects (value/selected/roving-tabindex ref). A tab wrapper that swallows them makes
// MUI's roving-tabindex re-register every render -> "Maximum update depth exceeded"
// (React #185) on every detail page. These render SubRouterTabs and assert it settles.
//
// jsdom lacks ResizeObserver / matchMedia, which MUI <Tabs> uses; provide them so the
// test fails only on a real render loop, not a missing-API console error.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia =
    window.matchMedia ||
    ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent() {
          return false;
        },
      }) as unknown as MediaQueryList);
});

function DetailPage() {
  return (
    <SubRouterTabs rootPath="details">
      <RouterTab name="Details" path="details">
        <div>DETAILS CONTENT</div>
      </RouterTab>
      <RouterTab name="Events" path="events">
        <div>EVENTS CONTENT</div>
      </RouterTab>
    </SubRouterTabs>
  );
}

function renderAt(path: string) {
  return render(
    withTheme(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/helm_release/*" element={<DetailPage />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}

describe("SubRouterTabs routing", () => {
  it("renders the default tab when deep-linked", () => {
    renderAt("/helm_release/details");
    expect(screen.queryByText("DETAILS CONTENT")).not.toBeNull();
  });

  it("redirects the bare detail path to the default tab and settles", () => {
    renderAt("/helm_release");
    expect(screen.queryByText("DETAILS CONTENT")).not.toBeNull();
  });

  it("renders a non-default tab when deep-linked", () => {
    renderAt("/helm_release/events");
    expect(screen.queryByText("EVENTS CONTENT")).not.toBeNull();
  });
});
