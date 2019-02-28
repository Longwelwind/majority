import {Popup} from "semantic-ui-react";
import * as React from "react";
import {ReactNode} from "react";

export default function addPopupConditionally(condition: boolean, content: string, trigger: ReactNode): ReactNode {
    if (condition) {
        return (
            <Popup
                trigger={trigger}
                content={content}
                // Should probably be an argument instead of hard-coding this
                // property, but the type of position is a set of string that
                // I'm too tired of copy-pasting.
                position={"bottom center"}
            />
        );
    } else {
        return trigger;
    }
}

