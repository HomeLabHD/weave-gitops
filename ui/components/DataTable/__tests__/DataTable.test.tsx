import { screen } from "@testing-library/dom";
import { fireEvent, render } from "@testing-library/react";
import "jest-styled-components";
import React from "react";
import { withContext, withTheme } from "../../../lib/test-utils";
import DataTable from "../DataTable";

describe("DataTable", () => {
  const rows = [
    {
      name: "the-cool-app",
      status: true,
      lastUpdate: "2005-01-02T15:04:05-0700",
      lastSyncedAt: 1000,
    },
    {
      name: "podinfo",
      status: false,
      lastUpdate: "2006-01-02T15:04:05-0700",
      lastSyncedAt: 2000,
    },
    {
      name: "nginx",
      status: "Ready",
      lastUpdate: "2004-01-02T15:04:05-0700",
      lastSyncedAt: 3000,
      suspended: true,
    },
  ];

  const fields = [
    {
      label: "Name",
      value: ({ name }) => <a href="/some_url">{name}</a>,
      sortValue: ({ name }) => name,
      defaultSort: true,
    },
    {
      label: "Status",
      value: "status",
      sortValue: ({ status, suspended }) => {
        if (suspended) return 2;
        if (status) return 3;
        else return 1;
      },
    },
    {
      label: "Last Updated",
      value: "lastUpdate",
      sortValue: ({ lastUpdate }) => lastUpdate,
    },
    {
      label: "Last Synced At",
      value: "lastSyncedAt",
      sortValue: ({ lastSyncedAt }) => lastSyncedAt,
    },
  ];

  describe("sorting", () => {
    it("initially sorts based on defaultSort", () => {
      render(
        withTheme(
          withContext(
            <DataTable fields={fields} rows={rows} />,
            "/applications",
            {},
          ),
        ),
      );
      const firstRow = screen.getAllByRole("row")[1];
      expect(firstRow.innerHTML).toMatch(/nginx/);
    });
    it("reverses sort on thead click", () => {
      render(
        withTheme(
          withContext(
            <DataTable fields={fields} rows={rows} />,
            "/applications",
            {},
          ),
        ),
      );

      const nameButton = screen.getByText("Name");
      fireEvent.click(nameButton);
      const firstRow = screen.getAllByRole("row")[1];
      expect(firstRow.innerHTML).toMatch(/the-cool-app/);
    });
    it("resets reverseSort and switches sort column on different thead click", () => {
      render(
        withTheme(
          withContext(
            <DataTable fields={fields} rows={rows} />,
            "/applications",
            {},
          ),
        ),
      );
      const nameButton = screen.getByText("Name");
      fireEvent.click(nameButton);
      const statusButton = screen.getByText("Status");
      fireEvent.click(statusButton);
      const firstRow = screen.getAllByRole("row")[1];
      expect(firstRow.innerHTML).toMatch(/podinfo/);
    });
    it("breaks ties deterministically by uid, regardless of input order", () => {
      // Status is low-cardinality (maps to 1-4), so these all tie. Without a stable
      // tiebreaker, lodash's stable sort mirrors the input order — which varies each
      // poll, reshuffling tied rows and jumping the scroll. The uid tiebreaker must
      // produce the SAME displayed order no matter how the source list is ordered.
      const tiedFields = [
        {
          label: "Status",
          value: "status",
          sortValue: ({ status, suspended }) =>
            suspended ? 2 : status ? 3 : 1,
          defaultSort: true,
        },
        { label: "Name", value: ({ name }) => name },
      ];
      const a = { uid: "aaa", name: "alpha", status: true };
      const b = { uid: "bbb", name: "bravo", status: true };
      const c = { uid: "ccc", name: "charlie", status: true };

      const orderOf = (rowsIn) => {
        const { container, unmount } = render(
          withTheme(
            withContext(
              <DataTable fields={tiedFields} rows={rowsIn} />,
              "/applications",
              {},
            ),
          ),
        );
        const names = Array.from(
          container.querySelectorAll("tbody tr"),
        ).map((tr) => tr.textContent);
        unmount();
        return names;
      };

      const order1 = orderOf([a, b, c]);
      const order2 = orderOf([c, a, b]);
      const order3 = orderOf([b, c, a]);

      expect(order1).toEqual(order2);
      expect(order2).toEqual(order3);
      // deterministic order is the uid order: aaa, bbb, ccc
      expect(order1.join("|")).toMatch(/alpha.*bravo.*charlie/);
    });
    it("should render text when rows are empty", () => {
      render(
        withTheme(
          withContext(
            <DataTable fields={fields} rows={[]} />,
            "/applications",
            {},
          ),
        ),
      );
      const firstRow = screen.getAllByRole("row")[1];
      expect(firstRow.innerHTML).toMatch(/No/);
    });
    it("sorts by value when no sortValue property exists", () => {
      const rows = [
        {
          name: "b",
        },
        {
          name: "c",
        },
        {
          name: "a",
        },
      ];

      const fields = [
        {
          label: "Name",
          value: "name",
        },
      ];

      render(
        withTheme(
          withContext(
            <DataTable fields={fields} rows={rows} />,
            "/applications",
            {},
          ),
        ),
      );

      let firstRow = screen.getAllByRole("row")[1];
      expect(firstRow.innerHTML).toMatch(/a/);

      const nameButton = screen.getByText("Name");
      fireEvent.click(nameButton);

      firstRow = screen.getAllByRole("row")[1];
      expect(firstRow.innerHTML).toMatch(/c/);
    });
    it("disables sorting", () => {
      const rows = [
        {
          name: "b",
        },
        {
          name: "c",
        },
        {
          name: "a",
        },
      ];

      const fields = [
        {
          label: "Name",
          value: "name",
        },
      ];

      render(
        withTheme(
          withContext(
            <DataTable disableSort fields={fields} rows={rows} />,
            "/applications",
            {},
          ),
        ),
      );

      const nameButton = screen.getByText("Name");
      fireEvent.click(nameButton);

      const firstRow = screen.getAllByRole("row")[1];
      expect(firstRow.innerHTML).toMatch(/b/);
    });
  });

  describe("snapshots", () => {
    it("renders", () => {
      const tree = render(
        withTheme(
          withContext(
            <DataTable fields={fields} rows={rows} />,
            "/applications",
            {},
          ),
        ),
      ).asFragment();
      expect(tree).toMatchSnapshot();
    });
  });
});
