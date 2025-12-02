import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@carbon/react";
import { RecentlyViewed } from "@carbon/icons-react";
import FormComponent from "@components/FormComponent";

const RunPage = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div className="contextPage">
        <h1 className="sectionTitle">Recursive Prompt Improver</h1>
        <Button
          size="md"
          renderIcon={RecentlyViewed}
          kind="tertiary"
          onClick={() => navigate("/sessions")}
        >
          Sessions
        </Button>
      </div>
      <FormComponent />
    </div>
  );
};

export default RunPage;
