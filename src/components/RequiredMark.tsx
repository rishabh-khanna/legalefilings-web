// Shared "this field is required" marker — one red asterisk after a
// field's label, used on every form field that's actually enforced as
// required (both a `required` attribute/manual validation on the input
// and, where the field is real master data, a matching server-side
// check). Not decorative — every place this renders, the field really
// does block submission when left blank.
export function RequiredMark() {
  return (
    <span aria-hidden="true" style={{ color: "#b42318" }}>
      {" "}
      *
    </span>
  );
}
